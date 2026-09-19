const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const p = path.join(dir, file);
    const stat = fs.statSync(p);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(p));
    } else if (file.endsWith('.swift')) {
      results.push(p);
    }
  });
  return results;
}

const sourcesDir = path.join(__dirname, '../node_modules/expo-modules-jsi/apple/Sources');

// 1. Patch Swift files for Swift 6 Sendable concurrency & weak var
if (fs.existsSync(sourcesDir)) {
  const files = walk(sourcesDir);
  let count = 0;
  files.forEach(f => {
    let c = fs.readFileSync(f, 'utf8');
    let modified = false;

    // Replace weak runtime properties with nonisolated(unsafe) weak var so Sendable classes don't trigger mutable stored property errors
    if (c.includes('weak let runtime') || c.includes('weak var runtime')) {
      c = c.replace(/private\s+weak\s+(?:let|var)\s+runtime:/g, 'nonisolated(unsafe) private weak var runtime:');
      c = c.replace(/internal\s+weak\s+(?:let|var)\s+runtime:/g, 'nonisolated(unsafe) internal weak var runtime:');
      modified = true;
    }

    // Replace any remaining weak let with weak var
    if (c.includes('weak let')) {
      c = c.replace(/weak let/g, 'weak var');
      modified = true;
    }

    // Mark Sendable classes with weak properties as @unchecked Sendable
    if (f.endsWith('JavaScriptPropNameID.swift') && c.includes('class JavaScriptPropNameID: JavaScriptType')) {
      c = c.replace('class JavaScriptPropNameID: JavaScriptType', 'class JavaScriptPropNameID: @unchecked Sendable, JavaScriptType');
      modified = true;
    }
    if (f.endsWith('JavaScriptError.swift') && c.includes('class JavaScriptError: Error, Sendable')) {
      c = c.replace('class JavaScriptError: Error, Sendable', 'class JavaScriptError: Error, @unchecked Sendable');
      modified = true;
    }
    if (f.endsWith('JavaScriptValue.swift') && c.includes('class JavaScriptValue: JavaScriptType')) {
      c = c.replace('class JavaScriptValue: JavaScriptType', 'class JavaScriptValue: @unchecked Sendable, JavaScriptType');
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(f, c);
      count++;
    }
  });
  console.log(`[patch] Patched ${count} Swift files for Swift 6 Sendable concurrency`);

  // 2. Patch Task+immediate.swift for compatibility
  const taskImmediate = path.join(sourcesDir, 'ExpoModulesJSI/Extensions/Task+immediate.swift');
  if (fs.existsSync(taskImmediate)) {
    let c = fs.readFileSync(taskImmediate, 'utf8');
    c = c.replace(/if #available[\s\S]*?else \{[\s\S]*?\n    \}/, 'return Task(priority: priority ?? .high, operation: operation)');
    fs.writeFileSync(taskImmediate, c);
    console.log('[patch] Patched Task+immediate.swift');
  }

  // 3. Patch HostObjectCallbacks.h with inline static appendPropNameId
  // (Prevents move-only PropNameID copy errors while keeping it 100% header-only and inlined)
  const hocPath = path.join(sourcesDir, 'ExpoModulesJSI-Cxx/include/HostObjectCallbacks.h');
  if (fs.existsSync(hocPath)) {
    let c = fs.readFileSync(hocPath, 'utf8');
    if (!c.includes('appendPropNameId')) {
      c = c.replace(
        'using Deallocator = void(Context);',
        'using Deallocator = void(Context);\n\n  inline static void appendPropNameId(PropNameIds &vector, facebook::jsi::IRuntime &runtime, const char *name) {\n    vector.push_back(facebook::jsi::PropNameID::forUtf8(runtime, std::string(name)));\n  }'
      );
      fs.writeFileSync(hocPath, c);
      console.log('[patch] Patched HostObjectCallbacks.h with inline appendPropNameId');
    }
  }

  // 4. Copy pristine RuntimeScheduler.h (with SWIFT_RETURNS_RETAINED)
  const rsPath = path.join(sourcesDir, 'ExpoModulesJSI-Cxx/include/RuntimeScheduler.h');
  const patchRs = path.join(__dirname, '../patches/RuntimeScheduler.h');
  if (fs.existsSync(patchRs) && fs.existsSync(rsPath)) {
    fs.copyFileSync(patchRs, rsPath);
    console.log('[patch] Copied patches/RuntimeScheduler.h (with SWIFT_RETURNS_RETAINED) into node_modules');
  }

  // 5. Patch JavaScriptRuntime.swift:
  // - appendPropNameId helper
  // - JsiSendablePointer to eliminate Swift 6 raw pointer data-race errors across actor boundaries
  // - pure Swift identifier validation
  const rt = path.join(sourcesDir, 'ExpoModulesJSI/Runtime/JavaScriptRuntime.swift');
  if (fs.existsSync(rt)) {
    let c = fs.readFileSync(rt, 'utf8');
    c = c.replace('_ arguments: consuming JavaScriptValuesBuffer,', '_ arguments: consuming JavaScriptValuesBuffer');

    // Replace the manual push_back loop with native C++ appendPropNameId
    c = c.replace(
      /for propertyName in propertyNames \{[\s\S]*?vector\.push_back[\s\S]*?\}/,
      'for propertyName in propertyNames {\n        expo.HostObjectCallbacks.appendPropNameId(&vector, iRuntime, propertyName)\n      }'
    );

    c = c.replace(/expo\.RuntimeScheduler\(\)/g, 'expo.createRuntimeScheduler()');
    c = c.replace(/expo\.RuntimeScheduler\(scheduler, fn\)/g, 'expo.createRuntimeScheduler(scheduler, fn)');

    c = c.replace(/\r\n/g, '\n');

    // Add JsiSendablePointer wrapper to eliminate Swift 6 raw pointer data-race errors across closures
    if (!c.includes('struct JsiSendablePointer')) {
      c = 'private struct JsiSendablePointer<T>: @unchecked Sendable {\n  let pointer: T\n  init(_ pointer: T) { self.pointer = pointer }\n}\n\n' + c;
    }

    const getterTarget = `      let propertyName = String(cString: propertyName)
      nonisolated(unsafe) let resultPtr = resultPtr

      return withGuaranteedContext(context) { (context: HostObjectContext, runtime) in
        return JavaScriptActor.assumeIsolated {
          return forwardingSwiftErrorsToJS(runtime: runtime) {
            try context.get(propertyName).writeJSIValue(to: resultPtr)
          }
        }
      }`;
    const getterReplacement = `      let propertyName = String(cString: propertyName)
      let sendableResultPtr = JsiSendablePointer(resultPtr)

      return withGuaranteedContext(context) { (context: HostObjectContext, runtime) in
        return JavaScriptActor.assumeIsolated {
          return forwardingSwiftErrorsToJS(runtime: runtime) {
            try context.get(propertyName).writeJSIValue(to: sendableResultPtr.pointer)
          }
        }
      }`;
    c = c.replace(getterTarget, getterReplacement);

    const call1Target = `    nonisolated(unsafe) let thisPtr = thisPtr
    nonisolated(unsafe) let argumentsPtr = argumentsPtr
    nonisolated(unsafe) let resultPtr = resultPtr

    // See \`withGuaranteedContext\` for why neither the context nor the runtime is retained here, and
    // why the result is written to the caller's slot instead of being returned.
    return withGuaranteedContext(context) { (context: HostFunctionContext, runtime) in
      return JavaScriptActor.assumeIsolated {
        return forwardingSwiftErrorsToJS(runtime: runtime) {
          let this = UnsafeMutablePointer(mutating: thisPtr).move()
          let arguments = JavaScriptValuesBuffer(runtime, start: argumentsPtr, count: argumentsCount)
          let thisValue = JavaScriptValue(runtime, this)
          try context.call(thisValue, consume arguments).writeJSIValue(to: resultPtr)
        }
      }
    }`;
    const call1Replacement = `    let sendableThisPtr = JsiSendablePointer(thisPtr)
    let sendableArgumentsPtr = JsiSendablePointer(argumentsPtr)
    let sendableResultPtr = JsiSendablePointer(resultPtr)

    // See \`withGuaranteedContext\` for why neither the context nor the runtime is retained here, and
    // why the result is written to the caller's slot instead of being returned.
    return withGuaranteedContext(context) { (context: HostFunctionContext, runtime) in
      return JavaScriptActor.assumeIsolated {
        return forwardingSwiftErrorsToJS(runtime: runtime) {
          let this = UnsafeMutablePointer(mutating: sendableThisPtr.pointer).move()
          let arguments = JavaScriptValuesBuffer(runtime, start: sendableArgumentsPtr.pointer, count: argumentsCount)
          let thisValue = JavaScriptValue(runtime, this)
          try context.call(thisValue, consume arguments).writeJSIValue(to: sendableResultPtr.pointer)
        }
      }
    }`;
    c = c.replace(call1Target, call1Replacement);

    const call2Target = `    nonisolated(unsafe) let thisPtr = thisPtr
    nonisolated(unsafe) let argumentsPtr = argumentsPtr
    nonisolated(unsafe) let resultPtr = resultPtr

    // See \`withGuaranteedContext\` for why neither the context nor the runtime is retained here, and
    // why the result is written to the caller's slot instead of being returned.
    return withGuaranteedContext(context) { (context: UnownedThisHostFunctionContext, runtime) in
      return JavaScriptActor.assumeIsolated {
        return forwardingSwiftErrorsToJS(runtime: runtime) {
          let arguments = JavaScriptValuesBuffer(runtime, start: argumentsPtr, count: argumentsCount)
          let thisValue = JavaScriptUnownedValue(runtime.pointee, thisPtr)
          try context.call(thisValue, consume arguments).writeJSIValue(to: resultPtr)
        }
      }
    }`;
    const call2Replacement = `    let sendableThisPtr = JsiSendablePointer(thisPtr)
    let sendableArgumentsPtr = JsiSendablePointer(argumentsPtr)
    let sendableResultPtr = JsiSendablePointer(resultPtr)

    // See \`withGuaranteedContext\` for why neither the context nor the runtime is retained here, and
    // why the result is written to the caller's slot instead of being returned.
    return withGuaranteedContext(context) { (context: UnownedThisHostFunctionContext, runtime) in
      return JavaScriptActor.assumeIsolated {
        return forwardingSwiftErrorsToJS(runtime: runtime) {
          let arguments = JavaScriptValuesBuffer(runtime, start: sendableArgumentsPtr.pointer, count: argumentsCount)
          let thisValue = JavaScriptUnownedValue(runtime.pointee, sendableThisPtr.pointer)
          try context.call(thisValue, consume arguments).writeJSIValue(to: sendableResultPtr.pointer)
        }
      }
    }`;
    c = c.replace(call2Target, call2Replacement);

    // Patch regex literal to pure non-throwing Swift identifier validation
    const validIdentifierCheck = `let isValidIdentifier = { guard let first = name.first, (first.isLetter || first == "_" || first == "$") else { return false }; return name.allSatisfy { $0.isLetter || $0.isNumber || $0 == "_" || $0 == "$" } }(); if !isValidIdentifier`;

    c = c.replace(
      'if name.wholeMatch(of: /^[a-zA-Z_$][a-zA-Z0-9_$]*$/) == nil',
      validIdentifierCheck
    );
    c = c.replace(
      'if (try? Regex(#"^[a-zA-Z_$][a-zA-Z0-9_$]*$"#))?.wholeMatch(in: name) == nil',
      validIdentifierCheck
    );

    fs.writeFileSync(rt, c);
    console.log('[patch] Patched JavaScriptRuntime.swift Sendable pointers and identifier check');
  }

  // 6. Patch JavaScriptPromise.swift with nonisolated init() for LongLivedState
  const promisePath = path.join(sourcesDir, 'ExpoModulesJSI/Runtime/Values/JavaScriptPromise.swift');
  if (fs.existsSync(promisePath)) {
    let c = fs.readFileSync(promisePath, 'utf8');
    c = c.replace(/\r\n/g, '\n');
    if (!c.includes('nonisolated init() {}')) {
      c = c.replace(
        'let rejectFunction = JavaScriptValue.Ref()\n\n    func allowRelease() {',
        'let rejectFunction = JavaScriptValue.Ref()\n\n    nonisolated init() {}\n\n    func allowRelease() {'
      );
      fs.writeFileSync(promisePath, c);
      console.log('[patch] Patched JavaScriptPromise.swift with nonisolated init()');
    }
  }
}
