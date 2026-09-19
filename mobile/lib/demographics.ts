/**
 * Unified Demographic Data Normalizer & Extractor for Mobile
 * Handles all variations from EaseID, DataVerify, SlipAPI, NIBSS, NIMC,
 * raw DB logs, nested objects, array responses, and stringified JSON.
 * Mirrors src/lib/demographics-parser.ts for full web-mobile parity.
 */

export interface NormalizedDemographics {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  gender?: string;
  dob?: string;
  phone?: string;
  nin?: string;
  bvn?: string;
  address?: string;
  residentialAddress?: string;
  stateOfOrigin?: string;
  lgaOfOrigin?: string;
  stateOfResidence?: string;
  lgaOfResidence?: string;
  nationality?: string;
  maritalStatus?: string;
  height?: string;
  weight?: string;
  title?: string;
  religion?: string;
  registrationDate?: string;
  enrollmentBank?: string;
  levelOfAccount?: string;
  nameOnCard?: string;
  watchListed?: string;
  email?: string;
  photo?: string;
  signature?: string;
  raw?: any;
}

export function parseDemographics(rawInput: any, fallbackFullName?: string): NormalizedDemographics {
  if (!rawInput && !fallbackFullName) {
    return {};
  }

  let data = rawInput;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      // Keep as is if not valid JSON
    }
  }

  // Handle nested EaseID/DataVerify response structures:
  // e.g. data.response[0], data.response.data, data.user_data, data.data, data.details, data.result
  let u: any = data;
  if (data && typeof data === "object") {
    if (Array.isArray(data.response) && data.response.length > 0) {
      u = data.response[0];
    } else if (data.response && typeof data.response === "object") {
      u = Array.isArray(data.response.data) ? data.response.data[0] : (data.response.data || data.response);
    } else if (Array.isArray(data.data) && data.data.length > 0) {
      u = data.data[0];
    } else if (data.user_data && typeof data.user_data === "object") {
      u = Array.isArray(data.user_data) ? data.user_data[0] : data.user_data;
    } else if (data.data && typeof data.data === "object") {
      u = data.data;
    } else if (data.details && typeof data.details === "object") {
      u = data.details;
    } else if (data.result && typeof data.result === "object") {
      u = data.result;
    }
  }

  const getVal = (...keys: string[]): string | undefined => {
    // 1. Direct exact match
    for (const k of keys) {
      if (u && typeof u === "object" && u[k] !== undefined && u[k] !== null && String(u[k]).trim() !== "") {
        return String(u[k]).trim();
      }
      if (data && typeof data === "object" && data[k] !== undefined && data[k] !== null && String(data[k]).trim() !== "") {
        return String(data[k]).trim();
      }
    }
    // 2. Case-insensitive match across all object keys
    const lowerKeys = new Set(keys.map((k) => k.toLowerCase()));
    if (u && typeof u === "object") {
      for (const objKey of Object.keys(u)) {
        if (lowerKeys.has(objKey.toLowerCase()) && u[objKey] !== undefined && u[objKey] !== null && String(u[objKey]).trim() !== "") {
          return String(u[objKey]).trim();
        }
      }
    }
    if (data && typeof data === "object") {
      for (const objKey of Object.keys(data)) {
        if (lowerKeys.has(objKey.toLowerCase()) && data[objKey] !== undefined && data[objKey] !== null && String(data[objKey]).trim() !== "") {
          return String(data[objKey]).trim();
        }
      }
    }
    return undefined;
  };

  const firstName = getVal("firstname", "first_name", "firstName", "given_name", "name");
  const lastName = getVal("surname", "last_name", "lastname", "lastName", "family_name");
  const middleName = getVal("middlename", "middle_name", "middleName", "other_name", "othername");
  const nameOnCard = getVal("nameOnCard", "name_on_card");

  // Construct Full Name
  const nameParts = [firstName, middleName, lastName].filter(Boolean);
  let computedFullName = nameParts.length > 0 ? nameParts.join(" ") : undefined;

  if (!computedFullName) {
    const rawDirectName = getVal("fullname", "fullName", "full_name", "applicant_name", "customer_name");
    if (rawDirectName && !rawDirectName.toLowerCase().includes("verified citizen") && !rawDirectName.toLowerCase().includes("enclosed in")) {
      computedFullName = rawDirectName;
    } else if (nameOnCard) {
      computedFullName = nameOnCard;
    }
  }

  // Check fallback if computed is still empty or a generic placeholder
  let finalFullName = computedFullName;
  if (!finalFullName || finalFullName.toLowerCase().includes("verified citizen") || finalFullName.toLowerCase().includes("enclosed in")) {
    if (fallbackFullName && !fallbackFullName.toLowerCase().includes("verified citizen") && !fallbackFullName.toLowerCase().includes("enclosed in")) {
      finalFullName = fallbackFullName;
    }
  }

  const gender = getVal("gender", "sex");
  const dob = getVal("birthday", "birthdate", "birth_date", "birthDate", "date_of_birth", "dob", "dateOfBirth");
  const phone = getVal("telephoneno", "telephoneNo", "telephone_no", "phone", "phone_number", "phoneNumber", "mobile", "telephone");
  const nin = getVal("nin", "vnin", "national_id", "nationalIdentityNumber");
  const bvn = getVal("bvn", "bank_verification_number", "bvn_number");

  const rawAddress = getVal("residentialAddress", "residential_address", "residence_AdressLine1", "residence_address", "address", "residence_state", "residence_Town");
  const address = rawAddress && rawAddress.trim().length > 0 ? rawAddress.trim() : undefined;

  const stateOfOrigin = getVal("stateOfOrigin", "state_of_origin", "origin_state", "state_origin");
  const lgaOfOrigin = getVal("lgaOfOrigin", "lga_of_origin", "origin_lga", "lga_origin");
  const stateOfResidence = getVal("stateOfResidence", "state_of_residence", "residence_state");
  const lgaOfResidence = getVal("lgaOfResidence", "lga_of_residence", "residence_lga");
  const nationality = getVal("nationality", "country");
  const maritalStatus = getVal("maritalStatus", "marital_status");
  const height = getVal("height", "heigth");
  const weight = getVal("weight");
  const title = getVal("title");
  const religion = getVal("religion");
  const registrationDate = getVal("registrationDate", "registration_date", "enrollment_date", "enrollmentDate");
  const enrollmentBank = getVal("enrollmentBank", "enrollment_bank", "bank_code");
  const levelOfAccount = getVal("levelOfAccount", "level_of_account", "accountLevel", "account_level");
  const watchListed = getVal("watchListed", "watch_listed");

  const rawEmail = getVal("email", "email_address", "mail");
  const email = rawEmail && rawEmail.includes("@") ? rawEmail : undefined;

  const rawPhoto = getVal("photo", "image", "passport", "photo_base64", "picture");
  let photo: string | undefined = undefined;
  if (rawPhoto) {
    photo = rawPhoto.startsWith("data:") || rawPhoto.startsWith("http") ? rawPhoto : `data:image/jpeg;base64,${rawPhoto}`;
  }

  const signature = getVal("signature", "sign", "signature_base64");

  return {
    fullName: finalFullName,
    firstName,
    lastName,
    middleName,
    gender: gender ? gender.toUpperCase() : undefined,
    dob,
    phone,
    nin,
    bvn,
    address,
    residentialAddress: address,
    stateOfOrigin,
    lgaOfOrigin,
    stateOfResidence,
    lgaOfResidence,
    nationality,
    maritalStatus,
    height,
    weight,
    title,
    religion,
    registrationDate,
    enrollmentBank,
    levelOfAccount,
    nameOnCard,
    watchListed,
    email,
    photo,
    signature,
    raw: u || data,
  };
}
