import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import * as WebBrowser from "expo-web-browser";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  History,
  Info,
  Plus,
  Trash2,
  Upload,
  User,
  Users,
  Wallet,
  Building2,
  AlertTriangle,
  CheckCircle2,
  X,
  CreditCard,
  Search,
  ExternalLink,
} from "lucide-react-native";
import { api, BASE_URL } from "../../lib/api";
import { getAuthToken } from "../../lib/storage";
import { uploadFileToServer } from "../../lib/upload";
import { colors } from "../../constants/theme";
import BrandLoader from "../../components/BrandLoader";
import CustomAlertModal, { AlertType } from "../../components/CustomAlertModal";
import { NIGERIA_DATA } from "../../constants/nigeria-data";
import { CAC_CATEGORIES } from "../../constants/cac-categories";
import { COUNTRY_CODES } from "../../constants/country-codes";

export type OwnershipType = "SOLE" | "PARTNERSHIP";

export interface CompanyInfo {
  email: string;
  commencementDate: string;
  state: string;
  city: string;
  streetNo: string;
  address: string;
}

export interface ProprietorDocument {
  nin: string | null;
  passport: string | null;
  signature: string | null;
}

export interface ProprietorItem {
  id: string;
  surname: string;
  firstName: string;
  otherName?: string;
  email: string;
  phoneCode: string;
  phone: string;
  gender: "MALE" | "FEMALE" | "";
  dob: string;
  state: string;
  lga: string;
  city: string;
  streetNo: string;
  serviceAddress: string;
  documents: ProprietorDocument;
}

const MONTHS = [
  { label: "January", short: "Jan", value: 1 },
  { label: "February", short: "Feb", value: 2 },
  { label: "March", short: "Mar", value: 3 },
  { label: "April", short: "Apr", value: 4 },
  { label: "May", short: "May", value: 5 },
  { label: "June", short: "Jun", value: 6 },
  { label: "July", short: "Jul", value: 7 },
  { label: "August", short: "Aug", value: 8 },
  { label: "September", short: "Sep", value: 9 },
  { label: "October", short: "Oct", value: 10 },
  { label: "November", short: "Nov", value: 11 },
  { label: "December", short: "Dec", value: 12 },
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function calculateAge(dobStr: string): number {
  if (!dobStr || !dobStr.includes("-")) return 0;
  const diff = Date.now() - new Date(dobStr).getTime();
  const ageDate = new Date(diff);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
}

function isValidEmail(email: string): boolean {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isValidPhone(phone: string): boolean {
  if (!phone) return false;
  return phone.replace(/\D/g, "").length >= 5;
}

function getIllegalSuffixError(name: string): string {
  if (!name) return "";
  const illegalWords = ["LTD", "LIMITED", "PLC", "INC", "INCORPORATED", "NIGERIAN"];
  const words = name.toUpperCase().split(/[\s,.-]+/);
  const found = words.find((w) => illegalWords.includes(w));
  if (found) {
    return `Business names cannot contain "${found}". Use Ventures, Enterprises, etc.`;
  }
  return "";
}

const DEFAULT_PROPRIETOR: ProprietorItem = {
  id: "1",
  surname: "",
  firstName: "",
  otherName: "",
  email: "",
  phoneCode: "+234",
  phone: "",
  gender: "",
  dob: "",
  state: "",
  lga: "",
  city: "",
  streetNo: "",
  serviceAddress: "",
  documents: { nin: null, passport: null, signature: null },
};

export default function BusinessNameScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ draftId?: string }>();

  // Current Step (0: Name Check, 1: Company Info, 2: Proprietors, 3: Documents, 4: Preview)
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [highestStepReached, setHighestStepReached] = useState<number>(0);

  // Draft Management State
  const [draftId, setDraftId] = useState<string | null>(params.draftId || null);
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isLoadingDraft, setIsLoadingDraft] = useState<boolean>(Boolean(params.draftId));

  // Service Pricing & Wallet
  const [servicePrice, setServicePrice] = useState<number>(29000);
  const [walletBalance, setWalletBalance] = useState<number>(0);

  // --- Step 0: Name Check & Structure State ---
  const [proposedName, setProposedName] = useState<string>("");
  const [altName1, setAltName1] = useState<string>("");
  const [altName2, setAltName2] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [specificNature, setSpecificNature] = useState<string>("");
  const [ownershipType, setOwnershipType] = useState<OwnershipType>("SOLE");

  // Name Check UI States
  const [isCheckingName, setIsCheckingName] = useState<boolean>(false);
  const [nameCheckResult, setNameCheckResult] = useState<{
    status: "IDLE" | "PASSED" | "WARNING" | "BLOCKED";
    message: string;
    conflicts: string[];
  }>({ status: "IDLE", message: "", conflicts: [] });
  const [isNameLocked, setIsNameLocked] = useState<boolean>(false);

  // --- Step 1: Company Information State ---
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({
    email: "",
    commencementDate: "",
    state: "",
    city: "",
    streetNo: "",
    address: "",
  });

  // --- Step 2: Proprietors State ---
  const [proprietors, setProprietors] = useState<ProprietorItem[]>([{ ...DEFAULT_PROPRIETOR, id: Date.now().toString() }]);
  const [expandedProprietorId, setExpandedProprietorId] = useState<string | null>(null);

  // --- Step 3: Document Uploads State ---
  const [uploadingSlots, setUploadingSlots] = useState<Record<string, boolean>>({});

  // --- Pickers & Modals ---
  const [isCategoryPickerVisible, setIsCategoryPickerVisible] = useState<boolean>(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState<string>("");

  const [isNaturePickerVisible, setIsNaturePickerVisible] = useState<boolean>(false);
  const [natureSearchQuery, setNatureSearchQuery] = useState<string>("");

  const [isStatePickerVisible, setIsStatePickerVisible] = useState<boolean>(false);
  const [statePickerTarget, setStatePickerTarget] = useState<"company" | string>("company"); // "company" or proprietor.id

  const [isLgaPickerVisible, setIsLgaPickerVisible] = useState<boolean>(false);
  const [lgaPickerProprietorId, setLgaPickerProprietorId] = useState<string | null>(null);

  const [isDatePickerVisible, setIsDatePickerVisible] = useState<boolean>(false);
  const [datePickerTarget, setDatePickerTarget] = useState<"commencement" | string>("commencement");

  const [isCountryCodePickerVisible, setIsCountryCodePickerVisible] = useState<boolean>(false);
  const [countryCodeTargetProprietorId, setCountryCodeTargetProprietorId] = useState<string | null>(null);

  // Full-screen Image / Document Viewer Modal
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);

  // Checkout & Payment Modal
  const [isCheckoutModalVisible, setIsCheckoutModalVisible] = useState<boolean>(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);

  // Alert State
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    type?: AlertType;
    title: string;
    message: string;
    confirmText?: string;
    onConfirm?: () => void;
  }>({
    visible: false,
    title: "",
    message: "",
  });

  const categories = useMemo(() => Object.keys(CAC_CATEGORIES).sort(), []);
  const specificNatures = useMemo(() => {
    if (!selectedCategory || !CAC_CATEGORIES[selectedCategory]) return [];
    return [...CAC_CATEGORIES[selectedCategory]].sort();
  }, [selectedCategory]);

  // Load wallet & pricing on mount
  useEffect(() => {
    const fetchWalletAndPricing = async () => {
      try {
        const [walletRes, pricingRes] = await Promise.all([
          api.get<any>("/api/user/wallet").catch(() => null),
          api.get<any>("/api/pricing").catch(() => null),
        ]);

        if (walletRes?.success && walletRes?.wallet) {
          setWalletBalance(Number(walletRes.wallet.balance) || 0);
        } else if (walletRes?.balance !== undefined) {
          setWalletBalance(Number(walletRes.balance) || 0);
        }

        if (pricingRes?.data?.BUSINESS_NAME) {
          setServicePrice(Number(pricingRes.data.BUSINESS_NAME));
        }
      } catch (err) {
        // Fallback pricing remains 29000
      }
    };
    fetchWalletAndPricing();
  }, []);

  // Fetch Existing Draft if draftId provided
  useEffect(() => {
    if (!params.draftId) return;

    const loadDraft = async () => {
      setIsLoadingDraft(true);
      try {
        const res = await api.get<any>(`/api/cac/register/business-name/details/${params.draftId}`);
        if (res?.success && res?.data) {
          const d = res.data;
          setDraftId(d.id);
          setTrackingId(d.trackingId || null);
          setProposedName(d.proposedName || "");
          setAltName1(d.altName1 || "");
          setAltName2(d.altName2 || "");
          setSelectedCategory(d.category || "");
          setSpecificNature(d.specificNature || "");
          setOwnershipType((d.ownershipType as OwnershipType) || "SOLE");
          setIsNameLocked(true);

          setCompanyInfo({
            email: d.companyEmail || "",
            commencementDate: d.commencementDate || "",
            state: d.companyState || "",
            city: d.companyCity || "",
            streetNo: d.companyStreetNo || "",
            address: d.companyAddress || "",
          });

          if (d.proprietors && d.proprietors.length > 0) {
            setProprietors(
              d.proprietors.map((p: any) => ({
                id: p.id || Date.now().toString(),
                surname: p.surname || "",
                firstName: p.firstName || "",
                otherName: p.otherName || "",
                email: p.email || "",
                phoneCode: p.phoneCode || "+234",
                phone: p.phone || "",
                gender: (p.gender as "MALE" | "FEMALE") || "",
                dob: p.dob || "",
                state: p.state || "",
                lga: p.lga || "",
                city: p.city || "",
                streetNo: p.streetNo || "",
                serviceAddress: p.serviceAddress || "",
                documents: {
                  nin: p.ninUrl || null,
                  passport: p.passportUrl || null,
                  signature: p.signatureUrl || null,
                },
              }))
            );
          }

          // Advance to Step 1 or furthest populated step
          if (d.companyState && d.companyAddress) {
            setCurrentStep(2);
            setHighestStepReached(2);
          } else {
            setCurrentStep(1);
            setHighestStepReached(1);
          }
        }
      } catch (err) {
        Alert.alert("Draft Error", "Failed to load saved draft. Please try again.");
      } finally {
        setIsLoadingDraft(false);
      }
    };

    loadDraft();
  }, [params.draftId]);

  // Autosave Engine: Debounce save to database whenever in Step 1, 2, or 3
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveDraftToDB = useCallback(async () => {
    if (!draftId) return;
    setSaveStatus("saving");
    try {
      const res = await api.put<any>(`/api/cac/register/business-name/details/${draftId}`, {
        companyInfo,
        proprietors: proprietors.map((p) => ({
          ...p,
          ninUrl: p.documents.nin,
          passportUrl: p.documents.passport,
          signatureUrl: p.documents.signature,
        })),
        isDraft: true,
      });

      if (res?.success || res?.status === 200 || !res?.error) {
        setSaveStatus("saved");
      } else {
        setSaveStatus("error");
      }
    } catch {
      setSaveStatus("error");
    }
  }, [draftId, companyInfo, proprietors]);

  useEffect(() => {
    if (!draftId || currentStep === 0) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      saveDraftToDB();
    }, 1500);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [draftId, companyInfo, proprietors, currentStep, saveDraftToDB]);

  // Name Availability Check
  const handleCheckNameAvailability = async () => {
    if (!proposedName.trim()) {
      setAlertConfig({
        visible: true,
        type: "error",
        title: "Proposed Name Required",
        message: "Please enter the proposed business name to verify.",
      });
      return;
    }

    const words = proposedName.trim().split(/\s+/);
    if (words.length < 2) {
      setNameCheckResult({
        status: "BLOCKED",
        message: "CAC requires business names to be descriptive. Please use at least two words (e.g. 'Ade Ventures' instead of just 'Ade').",
        conflicts: [],
      });
      return;
    }

    const illegalSuffix = getIllegalSuffixError(proposedName);
    if (illegalSuffix) {
      setNameCheckResult({
        status: "BLOCKED",
        message: illegalSuffix,
        conflicts: [],
      });
      return;
    }

    setIsCheckingName(true);
    setNameCheckResult({ status: "IDLE", message: "", conflicts: [] });

    try {
      const res = await api.post<any>("/api/cac/name-check", {
        proposedName: proposedName.trim(),
        lineOfBusiness: specificNature || "General Merchandise",
        entityType: "Business Name",
        mode: "CHECK",
      });

      const conflicts = res?.conflicts || res?.conflictingNames || res?.similarNames || [];

      if (res?.isBlocked) {
        setNameCheckResult({
          status: "BLOCKED",
          message: res.reasonMessage || "This name is unavailable or conflicts with a registered trademark/entity.",
          conflicts,
        });
      } else if (res?.warningMessage) {
        setNameCheckResult({
          status: "WARNING",
          message: res.warningMessage,
          conflicts,
        });
      } else {
        setNameCheckResult({
          status: "PASSED",
          message: "Great news! This name is available and structured for registration.",
          conflicts: [],
        });
      }
    } catch {
      setNameCheckResult({
        status: "WARNING",
        message: "Registry search is currently taking longer than usual. You may proceed and our accreditation officers will review it manually.",
        conflicts: [],
      });
    } finally {
      setIsCheckingName(false);
    }
  };

  // Step 0: Proceed to Details & Create Draft
  const handleProceedFromStep0 = async () => {
    if (!proposedName.trim()) {
      Alert.alert("Required", "Please provide a proposed business name.");
      return;
    }
    if (!selectedCategory) {
      Alert.alert("Required", "Please select a business category.");
      return;
    }
    if (!specificNature) {
      Alert.alert("Required", "Please select the specific nature of business.");
      return;
    }

    const alt1Err = getIllegalSuffixError(altName1);
    const alt2Err = getIllegalSuffixError(altName2);
    if (alt1Err || alt2Err) {
      Alert.alert("Invalid Alternative Name", alt1Err || alt2Err);
      return;
    }

    try {
      setSaveStatus("saving");
      const res = await api.post<any>("/api/cac/register/draft", {
        proposedName: proposedName.trim().toUpperCase(),
        altName1: altName1.trim() ? altName1.trim().toUpperCase() : null,
        altName2: altName2.trim() ? altName2.trim().toUpperCase() : null,
        entityType: "Business Name",
        ownershipType,
        category: selectedCategory,
        specificNature,
        similarityScore: "0",
      });

      if (res?.success) {
        setDraftId(res.draftId);
        setTrackingId(res.trackingId);
        setIsNameLocked(true);
        setSaveStatus("saved");

        // Sync partnership requirement
        if (ownershipType === "PARTNERSHIP" && proprietors.length < 2) {
          setProprietors([
            { ...DEFAULT_PROPRIETOR, id: Date.now().toString() },
            { ...DEFAULT_PROPRIETOR, id: (Date.now() + 1).toString() },
          ]);
        }

        setCurrentStep(1);
        setHighestStepReached((h) => Math.max(h, 1));
      } else {
        Alert.alert("Error", res?.message || "Failed to initialize registration draft.");
      }
    } catch {
      Alert.alert("Network Error", "Unable to create draft. Please check your connection.");
    }
  };

  // Step 1 Validation
  const handleProceedFromStep1 = () => {
    if (!companyInfo.email.trim()) {
      Alert.alert("Required Field", "Please enter the company email.");
      return;
    }
    if (!isValidEmail(companyInfo.email)) {
      Alert.alert("Invalid Email", "Please enter a valid email format.");
      return;
    }
    if (!companyInfo.commencementDate) {
      Alert.alert("Required Field", "Please select the business commencement date.");
      return;
    }
    if (!companyInfo.state) {
      Alert.alert("Required Field", "Please select the company state.");
      return;
    }
    if (!companyInfo.city.trim()) {
      Alert.alert("Required Field", "Please enter the city.");
      return;
    }
    if (!companyInfo.streetNo.trim()) {
      Alert.alert("Required Field", "Please enter the street number.");
      return;
    }
    if (!companyInfo.address.trim()) {
      Alert.alert("Required Field", "Please enter the complete street address.");
      return;
    }

    saveDraftToDB();
    setCurrentStep(2);
    setHighestStepReached((h) => Math.max(h, 2));
  };

  // Step 2: Proprietor Management Helpers
  const handleAddProprietor = () => {
    const newId = Date.now().toString();
    setProprietors((prev) => [...prev, { ...DEFAULT_PROPRIETOR, id: newId }]);
    setExpandedProprietorId(newId);
  };

  const handleRemoveProprietor = (id: string) => {
    if (proprietors.length <= 1) {
      Alert.alert("Minimum Required", "At least one proprietor is required.");
      return;
    }
    setProprietors((prev) => prev.filter((p) => p.id !== id));
  };

  const updateProprietorField = (id: string, field: keyof ProprietorItem, value: any) => {
    setProprietors((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        if (field === "state") {
          return { ...p, state: value, lga: "" };
        }
        return { ...p, [field]: value };
      })
    );
  };

  // Step 2 Validation
  const handleProceedFromStep2 = () => {
    if (ownershipType === "SOLE" && proprietors.length !== 1) {
      Alert.alert("Invalid Structure", "Sole Proprietorship requires exactly 1 proprietor.");
      return;
    }
    if (ownershipType === "PARTNERSHIP" && proprietors.length < 2) {
      Alert.alert("Invalid Structure", "Partnerships require at least 2 proprietors.");
      return;
    }

    for (let i = 0; i < proprietors.length; i++) {
      const p = proprietors[i];
      const pNum = `Proprietor ${i + 1}`;
      if (!p.surname.trim() || !p.firstName.trim()) {
        Alert.alert("Incomplete", `${pNum} requires surname and first name.`);
        return;
      }
      if (!p.email.trim() || !isValidEmail(p.email)) {
        Alert.alert("Invalid Email", `${pNum} has an invalid or missing email.`);
        return;
      }
      if (!p.phone.trim() || !isValidPhone(p.phone)) {
        Alert.alert("Invalid Phone", `${pNum} has an invalid phone number.`);
        return;
      }
      if (!p.gender) {
        Alert.alert("Incomplete", `Please select gender for ${pNum}.`);
        return;
      }
      if (!p.dob) {
        Alert.alert("Incomplete", `Please enter date of birth for ${pNum}.`);
        return;
      }
      if (!p.state || !p.lga) {
        Alert.alert("Incomplete", `Please select state and LGA for ${pNum}.`);
        return;
      }
      if (!p.city.trim() || !p.streetNo.trim() || !p.serviceAddress.trim()) {
        Alert.alert("Incomplete", `Please enter city, street number, and service address for ${pNum}.`);
        return;
      }

      if (calculateAge(p.dob) < 18) {
        const adults = proprietors.filter((adult) => calculateAge(adult.dob) >= 18);
        if (adults.length < 2) {
          Alert.alert(
            "CAC Minor Policy",
            `${p.firstName || pNum} is under 18. CAC regulations mandate at least 2 adult partners when registering a minor.`
          );
          return;
        }
      }
    }

    saveDraftToDB();
    setCurrentStep(3);
    setHighestStepReached((h) => Math.max(h, 3));
  };

  // Step 3: Document Picking Handler
  const handlePickDocument = async (proprietorId: string, docKey: keyof ProprietorDocument) => {
    const slotKey = `${proprietorId}_${docKey}`;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: docKey === "nin" ? ["application/pdf", "image/jpeg", "image/png"] : ["image/jpeg", "image/png"],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const asset = result.assets[0];

      if (asset.size && asset.size > 5 * 1024 * 1024) {
        Alert.alert("File Too Large", "Document exceeds the 5MB size limit.");
        return;
      }

      setUploadingSlots((prev) => ({ ...prev, [slotKey]: true }));

      const uploadedUrl = await uploadFileToServer({
        uri: asset.uri,
        name: asset.name || `${docKey}.jpg`,
        mimeType: asset.mimeType || "image/jpeg",
      });

      setProprietors((prev) =>
        prev.map((p) => {
          if (p.id !== proprietorId) return p;
          return {
            ...p,
            documents: {
              ...p.documents,
              [docKey]: uploadedUrl,
            },
          };
        })
      );
    } catch (err: any) {
      Alert.alert("Upload Failed", err?.message || "Failed to upload document. Please try again.");
    } finally {
      setUploadingSlots((prev) => ({ ...prev, [slotKey]: false }));
    }
  };

  // Step 3 Validation
  const handleProceedFromStep3 = () => {
    for (let i = 0; i < proprietors.length; i++) {
      const p = proprietors[i];
      const pNum = `Proprietor ${i + 1} (${p.firstName || "Partner"})`;
      if (!p.documents.nin) {
        Alert.alert("Missing Document", `Please upload the NIN slip/card for ${pNum}.`);
        return;
      }
      if (!p.documents.passport) {
        Alert.alert("Missing Document", `Please upload the passport photograph for ${pNum}.`);
        return;
      }
      if (!p.documents.signature) {
        Alert.alert("Missing Document", `Please upload the signature image for ${pNum}.`);
        return;
      }
    }

    saveDraftToDB();
    setCurrentStep(4);
    setHighestStepReached((h) => Math.max(h, 4));
  };

  // Step 4: Checkout Execution
  const handleExecutePayment = async (method: "WALLET" | "ONLINE") => {
    if (!draftId) return;

    if (method === "WALLET" && walletBalance < servicePrice) {
      setAlertConfig({
        visible: true,
        type: "error",
        title: "Insufficient Wallet Balance",
        message: `This registration costs ₦${servicePrice.toLocaleString()}, but your current wallet balance is ₦${walletBalance.toLocaleString()}. Please fund your wallet to continue.`,
        confirmText: "Fund Wallet",
        onConfirm: () => {
          setAlertConfig((prev) => ({ ...prev, visible: false }));
          setIsCheckoutModalVisible(false);
          router.push("/(tabs)/wallet" as any);
        },
      });
      return;
    }

    setIsSubmittingPayment(true);
    try {
      // 1. Final sync to DB
      await api.put(`/api/cac/register/business-name/details/${draftId}`, {
        companyInfo,
        proprietors: proprietors.map((p) => ({
          ...p,
          ninUrl: p.documents.nin,
          passportUrl: p.documents.passport,
          signatureUrl: p.documents.signature,
        })),
        isDraft: false,
      });

      // 2. Execute Payment Checkout
      const checkoutRes = await api.post<any>("/api/payment/checkout", {
        registrationId: draftId,
        paymentMethod: method,
        service: "business",
      });

      if (!checkoutRes?.success) {
        throw new Error(checkoutRes?.message || "Payment processing could not be initialized.");
      }

      if (method === "WALLET") {
        setIsCheckoutModalVisible(false);
        setAlertConfig({
          visible: true,
          type: "success",
          title: "Application Submitted!",
          message: `Your Business Name registration for "${proposedName}" has been submitted successfully (REF: ${trackingId || draftId.slice(0, 8)}). Our accredited team will process your filing.`,
          confirmText: "View History",
          onConfirm: () => {
            setAlertConfig((prev) => ({ ...prev, visible: false }));
            router.replace("/services/business-name-history" as any);
          },
        });
      } else if (method === "ONLINE") {
        if (!checkoutRes.authorizationUrl) {
          throw new Error("Could not obtain gateway checkout link.");
        }
        setIsCheckoutModalVisible(false);
        await WebBrowser.openBrowserAsync(checkoutRes.authorizationUrl);
        router.replace("/services/business-name-history" as any);
      }
    } catch (err: any) {
      Alert.alert("Checkout Error", err?.message || "Payment failed. Please try again.");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleGoBack = () => {
    if (currentStep > 0) {
      setCurrentStep((p) => p - 1);
    } else {
      router.back();
    }
  };

  if (isLoadingDraft) {
    return (
      <View style={styles.loadingScreen}>
        <BrandLoader message="Loading registration draft..." />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Top Header */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 16) + 4 }]}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Business Name
          </Text>
          <View style={styles.statusPillRow}>
            <Text style={styles.headerSubtitle}>
              Step {currentStep + 1} of 5
            </Text>
            {draftId && (
              <View style={[styles.savePill, saveStatus === "saving" && styles.savePillActive]}>
                <Text style={styles.savePillText}>
                  {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : "Draft"}
                </Text>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity
          onPress={() => router.push("/services/business-name-history" as any)}
          style={styles.historyBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <History size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Step Indicator Bar */}
      <View style={styles.stepTrackContainer}>
        {[
          { step: 0, label: "Name" },
          { step: 1, label: "Company" },
          { step: 2, label: "Proprietors" },
          { step: 3, label: "Documents" },
          { step: 4, label: "Preview" },
        ].map((s) => {
          const isActive = currentStep === s.step;
          const isCompleted = currentStep > s.step;
          const isClickable = s.step <= highestStepReached;

          return (
            <TouchableOpacity
              key={s.step}
              disabled={!isClickable}
              onPress={() => setCurrentStep(s.step)}
              style={styles.stepTrackItem}
            >
              <View
                style={[
                  styles.stepBadge,
                  isActive && styles.stepBadgeActive,
                  isCompleted && styles.stepBadgeCompleted,
                ]}
              >
                {isCompleted ? (
                  <Check size={12} color="#FFFFFF" />
                ) : (
                  <Text style={[styles.stepBadgeText, isActive && styles.stepBadgeTextActive]}>
                    {s.step + 1}
                  </Text>
                )}
              </View>
              <Text style={[styles.stepLabel, isActive && styles.stepLabelActive]} numberOfLines={1}>
                {s.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* ========================================================================= */}
          {/* STEP 0: NAME SEARCH & STRUCTURE                                            */}
          {/* ========================================================================= */}
          {currentStep === 0 && (
            <View style={styles.stepContainer}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Proposed Business Name</Text>
                <Text style={styles.sectionDesc}>
                  Enter the name you wish to register. We will verify its structure against CAC guidelines.
                </Text>
              </View>

              {/* Proposed Name Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Proposed Name <Text style={styles.requiredStar}>*</Text>
                </Text>
                <View style={styles.nameSearchRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="e.g. Zenith Global Ventures"
                    placeholderTextColor={colors.textMuted}
                    value={proposedName}
                    onChangeText={(t) => {
                      setProposedName(t);
                      setNameCheckResult({ status: "IDLE", message: "", conflicts: [] });
                    }}
                    autoCapitalize="words"
                    editable={!isNameLocked}
                  />
                  {!isNameLocked && (
                    <TouchableOpacity
                      style={[styles.checkBtn, isCheckingName && styles.btnDisabled]}
                      onPress={handleCheckNameAvailability}
                      disabled={isCheckingName}
                    >
                      {isCheckingName ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.checkBtnText}>Check</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>

                {isNameLocked && (
                  <TouchableOpacity onPress={() => setIsNameLocked(false)} style={styles.editNameTrigger}>
                    <Text style={styles.editNameTriggerText}>Edit Name</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Name Check Feedback Box */}
              {nameCheckResult.status !== "IDLE" && (
                <View
                  style={[
                    styles.resultCard,
                    nameCheckResult.status === "PASSED" && styles.resultCardPassed,
                    nameCheckResult.status === "WARNING" && styles.resultCardWarning,
                    nameCheckResult.status === "BLOCKED" && styles.resultCardBlocked,
                  ]}
                >
                  <View style={styles.resultCardHeader}>
                    {nameCheckResult.status === "PASSED" ? (
                      <CheckCircle2 size={18} color="#10B981" />
                    ) : (
                      <AlertTriangle
                        size={18}
                        color={nameCheckResult.status === "BLOCKED" ? "#EF4444" : "#F59E0B"}
                      />
                    )}
                    <Text
                      style={[
                        styles.resultCardTitle,
                        nameCheckResult.status === "PASSED" && { color: "#10B981" },
                        nameCheckResult.status === "WARNING" && { color: "#D97706" },
                        nameCheckResult.status === "BLOCKED" && { color: "#EF4444" },
                      ]}
                    >
                      {nameCheckResult.status === "PASSED"
                        ? "Name Available"
                        : nameCheckResult.status === "WARNING"
                        ? "Check Warning"
                        : "Name Unavailable"}
                    </Text>
                  </View>
                  <Text style={styles.resultCardMessage}>{nameCheckResult.message}</Text>
                  {nameCheckResult.conflicts.length > 0 && (
                    <View style={styles.conflictsBox}>
                      <Text style={styles.conflictsTitle}>Potential Conflicts:</Text>
                      {nameCheckResult.conflicts.slice(0, 3).map((c, idx) => (
                        <Text key={idx} style={styles.conflictItem}>
                          • {c}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Alternative Names */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>1st Alternative Name (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Zenith Apex Enterprise"
                  placeholderTextColor={colors.textMuted}
                  value={altName1}
                  onChangeText={setAltName1}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>2nd Alternative Name (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Zenith Integrated Services"
                  placeholderTextColor={colors.textMuted}
                  value={altName2}
                  onChangeText={setAltName2}
                  autoCapitalize="words"
                />
              </View>

              {/* Category Picker Trigger */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Business Category <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TouchableOpacity
                  style={styles.pickerTrigger}
                  onPress={() => {
                    setCategorySearchQuery("");
                    setIsCategoryPickerVisible(true);
                  }}
                >
                  <Text style={[styles.pickerTriggerText, !selectedCategory && { color: colors.textMuted }]}>
                    {selectedCategory || "Select Category"}
                  </Text>
                  <ChevronDown size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Specific Nature Picker Trigger */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Specific Nature of Business <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TouchableOpacity
                  style={[styles.pickerTrigger, !selectedCategory && styles.pickerTriggerDisabled]}
                  disabled={!selectedCategory}
                  onPress={() => {
                    setNatureSearchQuery("");
                    setIsNaturePickerVisible(true);
                  }}
                >
                  <Text style={[styles.pickerTriggerText, !specificNature && { color: colors.textMuted }]}>
                    {specificNature || (selectedCategory ? "Select Specific Nature" : "Select Category First")}
                  </Text>
                  <ChevronDown size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Ownership Structure Selection */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Ownership Structure <Text style={styles.requiredStar}>*</Text>
                </Text>
                <View style={styles.ownershipRow}>
                  <TouchableOpacity
                    style={[styles.ownershipCard, ownershipType === "SOLE" && styles.ownershipCardSelected]}
                    onPress={() => setOwnershipType("SOLE")}
                  >
                    <View style={[styles.ownershipRadio, ownershipType === "SOLE" && styles.ownershipRadioActive]}>
                      {ownershipType === "SOLE" && <View style={styles.radioDot} />}
                    </View>
                    <User size={22} color={ownershipType === "SOLE" ? colors.primary : colors.textMuted} />
                    <Text style={[styles.ownershipTitle, ownershipType === "SOLE" && styles.ownershipTitleActive]}>
                      Sole Proprietor
                    </Text>
                    <Text style={styles.ownershipSubtitle}>Single owner (1 person)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.ownershipCard, ownershipType === "PARTNERSHIP" && styles.ownershipCardSelected]}
                    onPress={() => setOwnershipType("PARTNERSHIP")}
                  >
                    <View style={[styles.ownershipRadio, ownershipType === "PARTNERSHIP" && styles.ownershipRadioActive]}>
                      {ownershipType === "PARTNERSHIP" && <View style={styles.radioDot} />}
                    </View>
                    <Users size={22} color={ownershipType === "PARTNERSHIP" ? colors.primary : colors.textMuted} />
                    <Text style={[styles.ownershipTitle, ownershipType === "PARTNERSHIP" && styles.ownershipTitleActive]}>
                      Partnership
                    </Text>
                    <Text style={styles.ownershipSubtitle}>2 or more partners</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Next Step Action */}
              <TouchableOpacity style={styles.primaryActionBtn} onPress={handleProceedFromStep0}>
                <Text style={styles.primaryActionBtnText}>Save & Proceed to Details</Text>
                <ChevronRight size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}

          {/* ========================================================================= */}
          {/* STEP 1: COMPANY INFORMATION                                                */}
          {/* ========================================================================= */}
          {currentStep === 1 && (
            <View style={styles.stepContainer}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Company Information</Text>
                <Text style={styles.sectionDesc}>
                  Enter the principal contact and operational details of the business.
                </Text>
              </View>

              {/* Reference Info Card */}
              <View style={styles.refInfoCard}>
                <Text style={styles.refInfoLabel}>REGISTERING FOR</Text>
                <Text style={styles.refInfoName}>{proposedName}</Text>
                <Text style={styles.refInfoNature}>{specificNature}</Text>
                {trackingId && <Text style={styles.refInfoRef}>REF: {trackingId}</Text>}
              </View>

              {/* Company Email */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Company Email <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. info@zenithglobal.com"
                  placeholderTextColor={colors.textMuted}
                  value={companyInfo.email}
                  onChangeText={(t) => setCompanyInfo((prev) => ({ ...prev, email: t }))}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              {/* Commencement Date */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Business Commencement Date <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TouchableOpacity
                  style={styles.pickerTrigger}
                  onPress={() => {
                    setDatePickerTarget("commencement");
                    setIsDatePickerVisible(true);
                  }}
                >
                  <Text style={[styles.pickerTriggerText, !companyInfo.commencementDate && { color: colors.textMuted }]}>
                    {companyInfo.commencementDate || "Select Date (YYYY-MM-DD)"}
                  </Text>
                  <ChevronDown size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Company State */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Company State of Operation <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TouchableOpacity
                  style={styles.pickerTrigger}
                  onPress={() => {
                    setStatePickerTarget("company");
                    setIsStatePickerVisible(true);
                  }}
                >
                  <Text style={[styles.pickerTriggerText, !companyInfo.state && { color: colors.textMuted }]}>
                    {companyInfo.state || "Select State"}
                  </Text>
                  <ChevronDown size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* City & Street Number */}
              <View style={styles.rowTwoCols}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>
                    City / Town <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Ikeja"
                    placeholderTextColor={colors.textMuted}
                    value={companyInfo.city}
                    onChangeText={(t) => setCompanyInfo((prev) => ({ ...prev, city: t }))}
                  />
                </View>
                <View style={[styles.inputGroup, { width: 110 }]}>
                  <Text style={styles.inputLabel}>
                    Street No. <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 14"
                    placeholderTextColor={colors.textMuted}
                    value={companyInfo.streetNo}
                    onChangeText={(t) => setCompanyInfo((prev) => ({ ...prev, streetNo: t }))}
                  />
                </View>
              </View>

              {/* Full Street Address */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Full Street Address <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="e.g. 14 Awolowo Way, Ikeja, Lagos"
                  placeholderTextColor={colors.textMuted}
                  value={companyInfo.address}
                  onChangeText={(t) => setCompanyInfo((prev) => ({ ...prev, address: t }))}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Navigation Controls */}
              <View style={styles.bottomNavRow}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setCurrentStep(0)}>
                  <Text style={styles.secondaryBtnText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryActionBtnSmall} onPress={handleProceedFromStep1}>
                  <Text style={styles.primaryActionBtnText}>Save & Next</Text>
                  <ChevronRight size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: PROPRIETOR INFORMATION                                             */}
          {/* ========================================================================= */}
          {currentStep === 2 && (
            <View style={styles.stepContainer}>
              <View style={styles.sectionHeaderBetween}>
                <View>
                  <Text style={styles.sectionTitle}>Proprietor Information</Text>
                  <Text style={styles.sectionDesc}>
                    {ownershipType === "SOLE"
                      ? "1 proprietor required for Sole Proprietorship."
                      : "2 or more partners required for Partnership."}
                  </Text>
                </View>
                {ownershipType === "PARTNERSHIP" && (
                  <TouchableOpacity style={styles.addPartnerBtn} onPress={handleAddProprietor}>
                    <Plus size={16} color="#FFFFFF" />
                    <Text style={styles.addPartnerBtnText}>Add Partner</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Proprietor Cards List */}
              {proprietors.map((p, idx) => {
                const isExpanded = expandedProprietorId === p.id || proprietors.length === 1;
                const age = calculateAge(p.dob);
                const isMinor = p.dob && age < 18;

                return (
                  <View key={p.id} style={styles.proprietorCard}>
                    {/* Collapsible Header */}
                    <TouchableOpacity
                      style={styles.proprietorHeader}
                      onPress={() => setExpandedProprietorId(isExpanded ? null : p.id)}
                    >
                      <View style={styles.proprietorHeaderLeft}>
                        <View style={styles.avatarPill}>
                          <Text style={styles.avatarText}>{idx + 1}</Text>
                        </View>
                        <View>
                          <Text style={styles.proprietorName}>
                            {p.surname || p.firstName ? `${p.surname} ${p.firstName}` : `Proprietor ${idx + 1}`}
                          </Text>
                          <Text style={styles.proprietorSub}>{p.email || "Details pending"}</Text>
                        </View>
                      </View>
                      <View style={styles.proprietorHeaderRight}>
                        {proprietors.length > 1 && (
                          <TouchableOpacity
                            onPress={() => handleRemoveProprietor(p.id)}
                            style={styles.removeIconBtn}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Trash2 size={16} color="#EF4444" />
                          </TouchableOpacity>
                        )}
                        <ChevronDown
                          size={18}
                          color={colors.textMuted}
                          style={{ transform: [{ rotate: isExpanded ? "180deg" : "0deg" }] }}
                        />
                      </View>
                    </TouchableOpacity>

                    {/* Expanded Fields */}
                    {isExpanded && (
                      <View style={styles.proprietorBody}>
                        {/* Surname & First Name */}
                        <View style={styles.rowTwoCols}>
                          <View style={[styles.inputGroup, { flex: 1 }]}>
                            <Text style={styles.inputLabel}>
                              Surname <Text style={styles.requiredStar}>*</Text>
                            </Text>
                            <TextInput
                              style={styles.input}
                              placeholder="Family name"
                              placeholderTextColor={colors.textMuted}
                              value={p.surname}
                              onChangeText={(t) => updateProprietorField(p.id, "surname", t)}
                              autoCapitalize="words"
                            />
                          </View>
                          <View style={[styles.inputGroup, { flex: 1 }]}>
                            <Text style={styles.inputLabel}>
                              First Name <Text style={styles.requiredStar}>*</Text>
                            </Text>
                            <TextInput
                              style={styles.input}
                              placeholder="Given name"
                              placeholderTextColor={colors.textMuted}
                              value={p.firstName}
                              onChangeText={(t) => updateProprietorField(p.id, "firstName", t)}
                              autoCapitalize="words"
                            />
                          </View>
                        </View>

                        {/* Other Name & Email */}
                        <View style={styles.rowTwoCols}>
                          <View style={[styles.inputGroup, { flex: 1 }]}>
                            <Text style={styles.inputLabel}>Other Name</Text>
                            <TextInput
                              style={styles.input}
                              placeholder="Middle name"
                              placeholderTextColor={colors.textMuted}
                              value={p.otherName}
                              onChangeText={(t) => updateProprietorField(p.id, "otherName", t)}
                              autoCapitalize="words"
                            />
                          </View>
                          <View style={[styles.inputGroup, { flex: 1 }]}>
                            <Text style={styles.inputLabel}>
                              Email <Text style={styles.requiredStar}>*</Text>
                            </Text>
                            <TextInput
                              style={styles.input}
                              placeholder="partner@email.com"
                              placeholderTextColor={colors.textMuted}
                              value={p.email}
                              onChangeText={(t) => updateProprietorField(p.id, "email", t)}
                              keyboardType="email-address"
                              autoCapitalize="none"
                            />
                          </View>
                        </View>

                        {/* Phone with Country Code */}
                        <View style={styles.inputGroup}>
                          <Text style={styles.inputLabel}>
                            Phone Number <Text style={styles.requiredStar}>*</Text>
                          </Text>
                          <View style={styles.phoneInputRow}>
                            <TouchableOpacity
                              style={styles.countryCodeBtn}
                              onPress={() => {
                                setCountryCodeTargetProprietorId(p.id);
                                setIsCountryCodePickerVisible(true);
                              }}
                            >
                              <Text style={styles.countryCodeText}>{p.phoneCode || "+234"}</Text>
                              <ChevronDown size={14} color={colors.textMuted} />
                            </TouchableOpacity>
                            <TextInput
                              style={[styles.input, { flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }]}
                              placeholder="8012345678"
                              placeholderTextColor={colors.textMuted}
                              value={p.phone}
                              onChangeText={(t) => updateProprietorField(p.id, "phone", t)}
                              keyboardType="phone-pad"
                            />
                          </View>
                        </View>

                        {/* Gender & DOB */}
                        <View style={styles.rowTwoCols}>
                          <View style={[styles.inputGroup, { flex: 1 }]}>
                            <Text style={styles.inputLabel}>
                              Gender <Text style={styles.requiredStar}>*</Text>
                            </Text>
                            <View style={styles.genderRow}>
                              <TouchableOpacity
                                style={[styles.genderPill, p.gender === "MALE" && styles.genderPillActive]}
                                onPress={() => updateProprietorField(p.id, "gender", "MALE")}
                              >
                                <Text style={[styles.genderPillText, p.gender === "MALE" && styles.genderPillTextActive]}>
                                  Male
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[styles.genderPill, p.gender === "FEMALE" && styles.genderPillActive]}
                                onPress={() => updateProprietorField(p.id, "gender", "FEMALE")}
                              >
                                <Text style={[styles.genderPillText, p.gender === "FEMALE" && styles.genderPillTextActive]}>
                                  Female
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>

                          <View style={[styles.inputGroup, { flex: 1 }]}>
                            <Text style={styles.inputLabel}>
                              Date of Birth <Text style={styles.requiredStar}>*</Text>
                            </Text>
                            <TouchableOpacity
                              style={styles.pickerTrigger}
                              onPress={() => {
                                setDatePickerTarget(p.id);
                                setIsDatePickerVisible(true);
                              }}
                            >
                              <Text style={[styles.pickerTriggerText, !p.dob && { color: colors.textMuted }]}>
                                {p.dob || "YYYY-MM-DD"}
                              </Text>
                              <ChevronDown size={16} color={colors.textMuted} />
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Minor Warning Notice */}
                        {isMinor && (
                          <View style={styles.minorNotice}>
                            <AlertTriangle size={16} color="#D97706" />
                            <Text style={styles.minorNoticeText}>
                              Under 18 detected. CAC requires at least 2 adult partners when registering a minor.
                            </Text>
                          </View>
                        )}

                        {/* State & LGA */}
                        <View style={styles.rowTwoCols}>
                          <View style={[styles.inputGroup, { flex: 1 }]}>
                            <Text style={styles.inputLabel}>
                              State of Residence <Text style={styles.requiredStar}>*</Text>
                            </Text>
                            <TouchableOpacity
                              style={styles.pickerTrigger}
                              onPress={() => {
                                setStatePickerTarget(p.id);
                                setIsStatePickerVisible(true);
                              }}
                            >
                              <Text style={[styles.pickerTriggerText, !p.state && { color: colors.textMuted }]}>
                                {p.state || "Select State"}
                              </Text>
                              <ChevronDown size={16} color={colors.textMuted} />
                            </TouchableOpacity>
                          </View>

                          <View style={[styles.inputGroup, { flex: 1 }]}>
                            <Text style={styles.inputLabel}>
                              LGA <Text style={styles.requiredStar}>*</Text>
                            </Text>
                            <TouchableOpacity
                              style={[styles.pickerTrigger, !p.state && styles.pickerTriggerDisabled]}
                              disabled={!p.state}
                              onPress={() => {
                                setLgaPickerProprietorId(p.id);
                                setIsLgaPickerVisible(true);
                              }}
                            >
                              <Text style={[styles.pickerTriggerText, !p.lga && { color: colors.textMuted }]}>
                                {p.lga || "Select LGA"}
                              </Text>
                              <ChevronDown size={16} color={colors.textMuted} />
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* City & Street No */}
                        <View style={styles.rowTwoCols}>
                          <View style={[styles.inputGroup, { flex: 1 }]}>
                            <Text style={styles.inputLabel}>
                              City <Text style={styles.requiredStar}>*</Text>
                            </Text>
                            <TextInput
                              style={styles.input}
                              placeholder="City"
                              placeholderTextColor={colors.textMuted}
                              value={p.city}
                              onChangeText={(t) => updateProprietorField(p.id, "city", t)}
                            />
                          </View>
                          <View style={[styles.inputGroup, { width: 110 }]}>
                            <Text style={styles.inputLabel}>
                              Street No. <Text style={styles.requiredStar}>*</Text>
                            </Text>
                            <TextInput
                              style={styles.input}
                              placeholder="No."
                              placeholderTextColor={colors.textMuted}
                              value={p.streetNo}
                              onChangeText={(t) => updateProprietorField(p.id, "streetNo", t)}
                            />
                          </View>
                        </View>

                        {/* Service Address */}
                        <View style={styles.inputGroup}>
                          <Text style={styles.inputLabel}>
                            Residential / Service Address <Text style={styles.requiredStar}>*</Text>
                          </Text>
                          <TextInput
                            style={[styles.input, styles.textArea]}
                            placeholder="Residential address of proprietor"
                            placeholderTextColor={colors.textMuted}
                            value={p.serviceAddress}
                            onChangeText={(t) => updateProprietorField(p.id, "serviceAddress", t)}
                            multiline
                            numberOfLines={2}
                          />
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}

              {/* Navigation Controls */}
              <View style={styles.bottomNavRow}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setCurrentStep(1)}>
                  <Text style={styles.secondaryBtnText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryActionBtnSmall} onPress={handleProceedFromStep2}>
                  <Text style={styles.primaryActionBtnText}>Save & Next</Text>
                  <ChevronRight size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: DOCUMENT UPLOADS                                                   */}
          {/* ========================================================================= */}
          {currentStep === 3 && (
            <View style={styles.stepContainer}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Document Uploads</Text>
                <Text style={styles.sectionDesc}>
                  Upload clear IDs, passport photos, and signatures for each proprietor. (Max 5MB per file)
                </Text>
              </View>

              {proprietors.map((p, pIdx) => (
                <View key={p.id} style={styles.docProprietorSection}>
                  <Text style={styles.docProprietorTitle}>
                    {pIdx + 1}. {p.surname || "Proprietor"} {p.firstName}
                  </Text>

                  {/* 1. NIN Slip/Card */}
                  <View style={styles.uploadBox}>
                    <View style={styles.uploadBoxHeader}>
                      <View>
                        <Text style={styles.uploadBoxTitle}>
                          National Identity (NIN) <Text style={styles.requiredStar}>*</Text>
                        </Text>
                        <Text style={styles.uploadBoxSubtitle}>NIN Slip or e-ID Card (PDF, JPG, PNG)</Text>
                      </View>
                      {p.documents.nin && (
                        <TouchableOpacity onPress={() => setPreviewDocUrl(p.documents.nin)}>
                          <Text style={styles.viewDocLink}>View</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {p.documents.nin ? (
                      <View style={styles.uploadedStateRow}>
                        <CheckCircle2 size={18} color="#10B981" />
                        <Text style={styles.uploadedFileName} numberOfLines={1}>
                          NIN Document Attached
                        </Text>
                        <TouchableOpacity
                          style={styles.replaceBtn}
                          onPress={() => handlePickDocument(p.id, "nin")}
                          disabled={uploadingSlots[`${p.id}_nin`]}
                        >
                          <Text style={styles.replaceBtnText}>Replace</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.uploadSlotTrigger}
                        onPress={() => handlePickDocument(p.id, "nin")}
                        disabled={uploadingSlots[`${p.id}_nin`]}
                      >
                        {uploadingSlots[`${p.id}_nin`] ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <>
                            <Upload size={18} color={colors.primary} />
                            <Text style={styles.uploadSlotText}>Upload NIN Document</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* 2. Passport Photograph */}
                  <View style={styles.uploadBox}>
                    <View style={styles.uploadBoxHeader}>
                      <View>
                        <Text style={styles.uploadBoxTitle}>
                          Passport Photograph <Text style={styles.requiredStar}>*</Text>
                        </Text>
                        <Text style={styles.uploadBoxSubtitle}>Recent color photo on white background (JPG, PNG)</Text>
                      </View>
                      {p.documents.passport && (
                        <TouchableOpacity onPress={() => setPreviewDocUrl(p.documents.passport)}>
                          <Text style={styles.viewDocLink}>View</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {p.documents.passport ? (
                      <View style={styles.uploadedStateRow}>
                        <CheckCircle2 size={18} color="#10B981" />
                        <Text style={styles.uploadedFileName} numberOfLines={1}>
                          Passport Photo Attached
                        </Text>
                        <TouchableOpacity
                          style={styles.replaceBtn}
                          onPress={() => handlePickDocument(p.id, "passport")}
                          disabled={uploadingSlots[`${p.id}_passport`]}
                        >
                          <Text style={styles.replaceBtnText}>Replace</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.uploadSlotTrigger}
                        onPress={() => handlePickDocument(p.id, "passport")}
                        disabled={uploadingSlots[`${p.id}_passport`]}
                      >
                        {uploadingSlots[`${p.id}_passport`] ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <>
                            <Upload size={18} color={colors.primary} />
                            <Text style={styles.uploadSlotText}>Upload Passport Photo</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* 3. Signature */}
                  <View style={styles.uploadBox}>
                    <View style={styles.uploadBoxHeader}>
                      <View>
                        <Text style={styles.uploadBoxTitle}>
                          Signature <Text style={styles.requiredStar}>*</Text>
                        </Text>
                        <Text style={styles.uploadBoxSubtitle}>Signed clearly on plain white paper (JPG, PNG)</Text>
                      </View>
                      {p.documents.signature && (
                        <TouchableOpacity onPress={() => setPreviewDocUrl(p.documents.signature)}>
                          <Text style={styles.viewDocLink}>View</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {p.documents.signature ? (
                      <View style={styles.uploadedStateRow}>
                        <CheckCircle2 size={18} color="#10B981" />
                        <Text style={styles.uploadedFileName} numberOfLines={1}>
                          Signature Attached
                        </Text>
                        <TouchableOpacity
                          style={styles.replaceBtn}
                          onPress={() => handlePickDocument(p.id, "signature")}
                          disabled={uploadingSlots[`${p.id}_signature`]}
                        >
                          <Text style={styles.replaceBtnText}>Replace</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.uploadSlotTrigger}
                        onPress={() => handlePickDocument(p.id, "signature")}
                        disabled={uploadingSlots[`${p.id}_signature`]}
                      >
                        {uploadingSlots[`${p.id}_signature`] ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <>
                            <Upload size={18} color={colors.primary} />
                            <Text style={styles.uploadSlotText}>Upload Signature</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}

              {/* Navigation Controls */}
              <View style={styles.bottomNavRow}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setCurrentStep(2)}>
                  <Text style={styles.secondaryBtnText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryActionBtnSmall} onPress={handleProceedFromStep3}>
                  <Text style={styles.primaryActionBtnText}>Review Summary</Text>
                  <ChevronRight size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ========================================================================= */}
          {/* STEP 4: PREVIEW & REVIEW                                                  */}
          {/* ========================================================================= */}
          {currentStep === 4 && (
            <View style={styles.stepContainer}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Application Summary</Text>
                <Text style={styles.sectionDesc}>
                  Please review your details carefully before proceeding to payment.
                </Text>
              </View>

              {/* Business Overview Card */}
              <View style={styles.summaryCard}>
                <View style={styles.summaryCardHeader}>
                  <Text style={styles.summaryCardTitle}>Business Details</Text>
                  <TouchableOpacity onPress={() => setCurrentStep(0)}>
                    <Text style={styles.summaryEditLink}>Edit</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Proposed Name:</Text>
                  <Text style={styles.summaryValue}>{proposedName}</Text>
                </View>
                {altName1 ? (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Alt Name 1:</Text>
                    <Text style={styles.summaryValue}>{altName1}</Text>
                  </View>
                ) : null}
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Category:</Text>
                  <Text style={styles.summaryValue}>{selectedCategory}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Nature of Business:</Text>
                  <Text style={styles.summaryValue}>{specificNature}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Ownership Type:</Text>
                  <Text style={styles.summaryValue}>
                    {ownershipType === "SOLE" ? "Sole Proprietor" : "Partnership"}
                  </Text>
                </View>
              </View>

              {/* Company Information Card */}
              <View style={styles.summaryCard}>
                <View style={styles.summaryCardHeader}>
                  <Text style={styles.summaryCardTitle}>Company Information</Text>
                  <TouchableOpacity onPress={() => setCurrentStep(1)}>
                    <Text style={styles.summaryEditLink}>Edit</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Email:</Text>
                  <Text style={styles.summaryValue}>{companyInfo.email}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Commencement Date:</Text>
                  <Text style={styles.summaryValue}>{companyInfo.commencementDate}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>State / City:</Text>
                  <Text style={styles.summaryValue}>
                    {companyInfo.city}, {companyInfo.state}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Address:</Text>
                  <Text style={styles.summaryValue}>{companyInfo.address}</Text>
                </View>
              </View>

              {/* Proprietors Summary Cards */}
              <View style={styles.summaryCard}>
                <View style={styles.summaryCardHeader}>
                  <Text style={styles.summaryCardTitle}>Proprietor(s)</Text>
                  <TouchableOpacity onPress={() => setCurrentStep(2)}>
                    <Text style={styles.summaryEditLink}>Edit</Text>
                  </TouchableOpacity>
                </View>
                {proprietors.map((p, idx) => (
                  <View key={p.id} style={[styles.propSummaryItem, idx > 0 && styles.propSummaryItemBorder]}>
                    <Text style={styles.propSummaryName}>
                      {idx + 1}. {p.surname} {p.firstName} {p.otherName}
                    </Text>
                    <Text style={styles.propSummaryDetails}>
                      {p.gender} • DOB: {p.dob}
                    </Text>
                    <Text style={styles.propSummaryDetails}>
                      {p.email} • {p.phoneCode} {p.phone}
                    </Text>
                    <Text style={styles.propSummaryDetails}>
                      {p.city}, {p.lga}, {p.state}
                    </Text>
                    <View style={styles.docsSummaryPillRow}>
                      <View style={[styles.docStatusBadge, p.documents.nin && styles.docStatusBadgeOk]}>
                        <Text style={styles.docStatusBadgeText}>NIN</Text>
                      </View>
                      <View style={[styles.docStatusBadge, p.documents.passport && styles.docStatusBadgeOk]}>
                        <Text style={styles.docStatusBadgeText}>Passport</Text>
                      </View>
                      <View style={[styles.docStatusBadge, p.documents.signature && styles.docStatusBadgeOk]}>
                        <Text style={styles.docStatusBadgeText}>Signature</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>

              {/* Turnaround Time Pill */}
              <View style={styles.tatCard}>
                <Building2 size={20} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.tatTitle}>Fulfillment Duration</Text>
                  <Text style={styles.tatText}>1 – 48 Working Hours</Text>
                </View>
              </View>

              {/* Navigation Controls */}
              <View style={styles.bottomNavRow}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setCurrentStep(3)}>
                  <Text style={styles.secondaryBtnText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryActionBtnSmall, { backgroundColor: "#10B981" }]}
                  onPress={() => setIsCheckoutModalVisible(true)}
                >
                  <Text style={styles.primaryActionBtnText}>Proceed to Checkout</Text>
                  <ChevronRight size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ========================================================================= */}
      {/* CATEGORY PICKER MODAL                                                     */}
      {/* ========================================================================= */}
      <Modal
        visible={isCategoryPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsCategoryPickerVisible(false)}
      >
        <View style={styles.pickerModalBackdrop}>
          <View style={[styles.pickerModalContainer, { maxHeight: "80%" }]}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>Select Business Category</Text>
              <TouchableOpacity onPress={() => setIsCategoryPickerVisible(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Search filter */}
            <View style={styles.modalSearchBox}>
              <Search size={16} color={colors.textMuted} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search categories..."
                placeholderTextColor={colors.textMuted}
                value={categorySearchQuery}
                onChangeText={setCategorySearchQuery}
              />
            </View>

            <ScrollView showsVerticalScrollIndicator style={styles.pickerModalScroll}>
              {categories
                .filter((c) => c.toLowerCase().includes(categorySearchQuery.toLowerCase()))
                .map((cat) => {
                  const isSelected = selectedCategory === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.pickerListItem, isSelected && styles.pickerListItemActive]}
                      onPress={() => {
                        setSelectedCategory(cat);
                        setSpecificNature(""); // Reset nature when category changes
                        setIsCategoryPickerVisible(false);
                      }}
                    >
                      <Text style={[styles.pickerListItemText, isSelected && styles.pickerListItemTextActive]}>
                        {cat}
                      </Text>
                      {isSelected && <Check size={18} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* SPECIFIC NATURE PICKER MODAL                                              */}
      {/* ========================================================================= */}
      <Modal
        visible={isNaturePickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsNaturePickerVisible(false)}
      >
        <View style={styles.pickerModalBackdrop}>
          <View style={[styles.pickerModalContainer, { maxHeight: "80%" }]}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>Specific Nature of Business</Text>
              <TouchableOpacity onPress={() => setIsNaturePickerVisible(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Search filter */}
            <View style={styles.modalSearchBox}>
              <Search size={16} color={colors.textMuted} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search specific natures..."
                placeholderTextColor={colors.textMuted}
                value={natureSearchQuery}
                onChangeText={setNatureSearchQuery}
              />
            </View>

            <ScrollView showsVerticalScrollIndicator style={styles.pickerModalScroll}>
              {specificNatures
                .filter((n) => n.toLowerCase().includes(natureSearchQuery.toLowerCase()))
                .map((nat) => {
                  const isSelected = specificNature === nat;
                  return (
                    <TouchableOpacity
                      key={nat}
                      style={[styles.pickerListItem, isSelected && styles.pickerListItemActive]}
                      onPress={() => {
                        setSpecificNature(nat);
                        setIsNaturePickerVisible(false);
                      }}
                    >
                      <Text style={[styles.pickerListItemText, isSelected && styles.pickerListItemTextActive]}>
                        {nat}
                      </Text>
                      {isSelected && <Check size={18} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* STATE PICKER MODAL                                                        */}
      {/* ========================================================================= */}
      <Modal
        visible={isStatePickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsStatePickerVisible(false)}
      >
        <View style={styles.pickerModalBackdrop}>
          <View style={[styles.pickerModalContainer, { maxHeight: "75%" }]}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>Select State</Text>
              <TouchableOpacity onPress={() => setIsStatePickerVisible(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator style={styles.pickerModalScroll}>
              {NIGERIA_DATA.map((s) => {
                const isSelected =
                  statePickerTarget === "company"
                    ? companyInfo.state === s.state
                    : proprietors.find((p) => p.id === statePickerTarget)?.state === s.state;

                return (
                  <TouchableOpacity
                    key={s.state}
                    style={[styles.pickerListItem, isSelected && styles.pickerListItemActive]}
                    onPress={() => {
                      if (statePickerTarget === "company") {
                        setCompanyInfo((prev) => ({ ...prev, state: s.state }));
                      } else {
                        updateProprietorField(statePickerTarget, "state", s.state);
                      }
                      setIsStatePickerVisible(false);
                    }}
                  >
                    <Text style={[styles.pickerListItemText, isSelected && styles.pickerListItemTextActive]}>
                      {s.state}
                    </Text>
                    {isSelected && <Check size={18} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* LGA PICKER MODAL                                                          */}
      {/* ========================================================================= */}
      <Modal
        visible={isLgaPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsLgaPickerVisible(false)}
      >
        <View style={styles.pickerModalBackdrop}>
          <View style={[styles.pickerModalContainer, { maxHeight: "75%" }]}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>Select Local Government Area</Text>
              <TouchableOpacity onPress={() => setIsLgaPickerVisible(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator style={styles.pickerModalScroll}>
              {(() => {
                const targetProp = proprietors.find((p) => p.id === lgaPickerProprietorId);
                const lgas = NIGERIA_DATA.find((s) => s.state === targetProp?.state)?.lgas || [];
                return lgas.map((lga) => {
                  const isSelected = targetProp?.lga === lga;
                  return (
                    <TouchableOpacity
                      key={lga}
                      style={[styles.pickerListItem, isSelected && styles.pickerListItemActive]}
                      onPress={() => {
                        if (lgaPickerProprietorId) {
                          updateProprietorField(lgaPickerProprietorId, "lga", lga);
                        }
                        setIsLgaPickerVisible(false);
                      }}
                    >
                      <Text style={[styles.pickerListItemText, isSelected && styles.pickerListItemTextActive]}>
                        {lga}
                      </Text>
                      {isSelected && <Check size={18} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                });
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* COUNTRY CODE PICKER MODAL                                                 */}
      {/* ========================================================================= */}
      <Modal
        visible={isCountryCodePickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsCountryCodePickerVisible(false)}
      >
        <View style={styles.pickerModalBackdrop}>
          <View style={[styles.pickerModalContainer, { maxHeight: "60%" }]}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>Select Country Code</Text>
              <TouchableOpacity onPress={() => setIsCountryCodePickerVisible(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator style={styles.pickerModalScroll}>
              {COUNTRY_CODES.map((c) => (
                <TouchableOpacity
                  key={c.name}
                  style={styles.pickerListItem}
                  onPress={() => {
                    if (countryCodeTargetProprietorId) {
                      updateProprietorField(countryCodeTargetProprietorId, "phoneCode", c.code);
                    }
                    setIsCountryCodePickerVisible(false);
                  }}
                >
                  <Text style={styles.pickerListItemText}>
                    {c.flag} {c.name} ({c.code})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* DATE PICKER MODAL (Commencement or Proprietor DOB)                         */}
      {/* ========================================================================= */}
      <Modal
        visible={isDatePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsDatePickerVisible(false)}
      >
        <DatePickerComponent
          onClose={() => setIsDatePickerVisible(false)}
          onConfirmDate={(dateStr) => {
            if (datePickerTarget === "commencement") {
              setCompanyInfo((prev) => ({ ...prev, commencementDate: dateStr }));
            } else {
              updateProprietorField(datePickerTarget, "dob", dateStr);
            }
            setIsDatePickerVisible(false);
          }}
        />
      </Modal>

      {/* ========================================================================= */}
      {/* FULL-SIZE DOCUMENT PREVIEW MODAL                                          */}
      {/* ========================================================================= */}
      <Modal
        visible={Boolean(previewDocUrl)}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewDocUrl(null)}
      >
        <View style={styles.imagePreviewBackdrop}>
          <TouchableOpacity style={styles.closePreviewBtn} onPress={() => setPreviewDocUrl(null)}>
            <X size={24} color="#FFFFFF" />
          </TouchableOpacity>
          {previewDocUrl ? (
            <Image source={{ uri: previewDocUrl }} style={styles.fullPreviewImage} resizeMode="contain" />
          ) : null}
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* CHECKOUT & PAYMENT MODAL                                                  */}
      {/* ========================================================================= */}
      <Modal
        visible={isCheckoutModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !isSubmittingPayment && setIsCheckoutModalVisible(false)}
      >
        <View style={styles.pickerModalBackdrop}>
          <View style={styles.checkoutModalContainer}>
            <View style={styles.pickerModalHeader}>
              <View>
                <Text style={styles.pickerModalTitle}>Checkout & Payment</Text>
                <Text style={styles.pickerModalSub}>CAC Business Name Filing</Text>
              </View>
              <TouchableOpacity onPress={() => !isSubmittingPayment && setIsCheckoutModalVisible(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Price & Balance Box */}
            <View style={styles.checkoutPricingBox}>
              <View style={styles.pricingRow}>
                <Text style={styles.pricingLabel}>Registration Fee:</Text>
                <Text style={styles.pricingAmount}>₦{servicePrice.toLocaleString()}</Text>
              </View>
              <View style={styles.pricingRow}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Wallet size={15} color={colors.textMuted} style={{ marginRight: 6 }} />
                  <Text style={styles.pricingLabel}>Wallet Balance:</Text>
                </View>
                <Text
                  style={[
                    styles.pricingAmount,
                    walletBalance < servicePrice ? { color: "#EF4444" } : { color: "#10B981" },
                  ]}
                >
                  ₦{walletBalance.toLocaleString()}
                </Text>
              </View>
            </View>

            {walletBalance < servicePrice ? (
              <View style={styles.deficitBox}>
                <Text style={styles.deficitText}>
                  Your wallet balance is insufficient by ₦{(servicePrice - walletBalance).toLocaleString()}. You can fund your wallet or pay online directly.
                </Text>
              </View>
            ) : null}

            {/* Payment Options */}
            <View style={styles.paymentActionsContainer}>
              {/* Option 1: Pay with Wallet */}
              <TouchableOpacity
                style={[
                  styles.walletPayBtn,
                  walletBalance < servicePrice && styles.btnDisabled,
                  isSubmittingPayment && styles.btnDisabled,
                ]}
                disabled={walletBalance < servicePrice || isSubmittingPayment}
                onPress={() => handleExecutePayment("WALLET")}
              >
                {isSubmittingPayment ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Wallet size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.walletPayBtnText}>Pay ₦{servicePrice.toLocaleString()} from Wallet</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Option 2: Pay Online / Fund Wallet */}
              {walletBalance < servicePrice ? (
                <View style={styles.insufficientRow}>
                  <TouchableOpacity
                    style={styles.fundWalletBtn}
                    onPress={() => {
                      setIsCheckoutModalVisible(false);
                      router.push("/(tabs)/wallet" as any);
                    }}
                  >
                    <Plus size={16} color={colors.primary} style={{ marginRight: 4 }} />
                    <Text style={styles.fundWalletBtnText}>Fund Wallet</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.payOnlineBtn}
                    onPress={() => handleExecutePayment("ONLINE")}
                  >
                    <CreditCard size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text style={styles.payOnlineBtnText}>Pay Online</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.payOnlineSecondaryBtn}
                  onPress={() => handleExecutePayment("ONLINE")}
                  disabled={isSubmittingPayment}
                >
                  <CreditCard size={16} color={colors.text} style={{ marginRight: 6 }} />
                  <Text style={styles.payOnlineSecondaryBtnText}>Pay with Card / Transfer</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Global Alert Modal */}
      <CustomAlertModal
        visible={alertConfig.visible}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.message}
        confirmText={alertConfig.confirmText}
        onConfirm={alertConfig.onConfirm}
        onCancel={() => setAlertConfig((prev) => ({ ...prev, visible: false }))}
      />
    </View>
  );
}

// =========================================================================
// INTERNAL DATE PICKER HELPER COMPONENT
// =========================================================================
function DatePickerComponent({
  onClose,
  onConfirmDate,
}: {
  onClose: () => void;
  onConfirmDate: (dateStr: string) => void;
}) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(1995);
  const [selectedMonth, setSelectedMonth] = useState<number>(1);
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<"year" | "month" | "day">("year");

  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = currentYear; y >= 1940; y--) {
      arr.push(y);
    }
    return arr;
  }, [currentYear]);

  const maxDays = getDaysInMonth(selectedYear, selectedMonth);
  const days = Array.from({ length: maxDays }, (_, i) => i + 1);

  const handleConfirm = () => {
    const mm = selectedMonth < 10 ? `0${selectedMonth}` : `${selectedMonth}`;
    const dd = selectedDay < 10 ? `0${selectedDay}` : `${selectedDay}`;
    onConfirmDate(`${selectedYear}-${mm}-${dd}`);
  };

  return (
    <View style={dateStyles.backdrop}>
      <View style={dateStyles.container}>
        <View style={dateStyles.header}>
          <Text style={dateStyles.title}>Select Date</Text>
          <TouchableOpacity onPress={onClose}>
            <X size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Column Navigation Tabs */}
        <View style={dateStyles.tabRow}>
          <TouchableOpacity
            style={[dateStyles.tabBtn, activeTab === "year" && dateStyles.tabBtnActive]}
            onPress={() => setActiveTab("year")}
          >
            <Text style={[dateStyles.tabBtnText, activeTab === "year" && dateStyles.tabBtnTextActive]}>
              Year: {selectedYear}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[dateStyles.tabBtn, activeTab === "month" && dateStyles.tabBtnActive]}
            onPress={() => setActiveTab("month")}
          >
            <Text style={[dateStyles.tabBtnText, activeTab === "month" && dateStyles.tabBtnTextActive]}>
              {MONTHS.find((m) => m.value === selectedMonth)?.short || "Jan"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[dateStyles.tabBtn, activeTab === "day" && dateStyles.tabBtnActive]}
            onPress={() => setActiveTab("day")}
          >
            <Text style={[dateStyles.tabBtnText, activeTab === "day" && dateStyles.tabBtnTextActive]}>
              Day: {selectedDay}
            </Text>
          </TouchableOpacity>
        </View>

        {/* List Content */}
        <View style={dateStyles.body}>
          {activeTab === "year" && (
            <ScrollView showsVerticalScrollIndicator style={dateStyles.scroll}>
              <View style={dateStyles.grid}>
                {years.map((y) => (
                  <TouchableOpacity
                    key={y}
                    style={[dateStyles.pill, y === selectedYear && dateStyles.pillActive]}
                    onPress={() => {
                      setSelectedYear(y);
                      setActiveTab("month");
                    }}
                  >
                    <Text style={[dateStyles.pillText, y === selectedYear && dateStyles.pillTextActive]}>{y}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}

          {activeTab === "month" && (
            <ScrollView showsVerticalScrollIndicator style={dateStyles.scroll}>
              <View style={dateStyles.grid}>
                {MONTHS.map((m) => (
                  <TouchableOpacity
                    key={m.value}
                    style={[dateStyles.pill, m.value === selectedMonth && dateStyles.pillActive]}
                    onPress={() => {
                      setSelectedMonth(m.value);
                      setActiveTab("day");
                    }}
                  >
                    <Text style={[dateStyles.pillText, m.value === selectedMonth && dateStyles.pillTextActive]}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}

          {activeTab === "day" && (
            <ScrollView showsVerticalScrollIndicator style={dateStyles.scroll}>
              <View style={dateStyles.grid}>
                {days.map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[dateStyles.pill, d === selectedDay && dateStyles.pillActive]}
                    onPress={() => setSelectedDay(d)}
                  >
                    <Text style={[dateStyles.pillText, d === selectedDay && dateStyles.pillTextActive]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}
        </View>

        {/* Footer Confirm */}
        <View style={dateStyles.footer}>
          <TouchableOpacity style={dateStyles.confirmBtn} onPress={handleConfirm}>
            <Text style={dateStyles.confirmBtnText}>Confirm Date</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// =========================================================================
// STYLES
// =========================================================================
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  topBar: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  headerCenter: {
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  statusPillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
  },
  savePill: {
    backgroundColor: "#E5E7EB",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  savePillActive: {
    backgroundColor: "#DBEAFE",
  },
  savePillText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
  },
  historyBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFF6FF",
  },
  stepTrackContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    justifyContent: "space-between",
  },
  stepTrackItem: {
    alignItems: "center",
    flex: 1,
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  stepBadgeActive: {
    backgroundColor: colors.primary,
  },
  stepBadgeCompleted: {
    backgroundColor: "#10B981",
  },
  stepBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
  },
  stepBadgeTextActive: {
    color: "#FFFFFF",
  },
  stepLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.textMuted,
  },
  stepLabelActive: {
    color: colors.primary,
    fontWeight: "800",
  },
  scrollContent: {
    padding: 16,
  },
  stepContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sectionHeader: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    paddingBottom: 12,
  },
  sectionHeaderBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
  },
  sectionDesc: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 6,
  },
  requiredStar: {
    color: "#EF4444",
  },
  input: {
    height: 48,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.text,
    fontWeight: "600",
  },
  textArea: {
    height: 72,
    paddingTop: 10,
    textAlignVertical: "top",
  },
  nameSearchRow: {
    flexDirection: "row",
    gap: 8,
  },
  checkBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    height: 48,
  },
  checkBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  editNameTrigger: {
    marginTop: 6,
    alignSelf: "flex-end",
  },
  editNameTriggerText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: "700",
  },
  resultCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  resultCardPassed: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  resultCardWarning: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
  },
  resultCardBlocked: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  resultCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  resultCardTitle: {
    fontSize: 13,
    fontWeight: "800",
  },
  resultCardMessage: {
    fontSize: 12,
    color: colors.text,
    lineHeight: 17,
  },
  conflictsBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  conflictsTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    marginBottom: 2,
  },
  conflictItem: {
    fontSize: 11,
    color: colors.text,
  },
  pickerTrigger: {
    height: 48,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerTriggerDisabled: {
    backgroundColor: "#F9FAFB",
    opacity: 0.6,
  },
  pickerTriggerText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    flex: 1,
  },
  ownershipRow: {
    flexDirection: "row",
    gap: 12,
  },
  ownershipCard: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  ownershipCardSelected: {
    borderColor: colors.primary,
    backgroundColor: "#EFF6FF",
  },
  ownershipRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-end",
    marginBottom: 6,
  },
  ownershipRadioActive: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  ownershipTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
    marginTop: 4,
  },
  ownershipTitleActive: {
    color: colors.primary,
  },
  ownershipSubtitle: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: "center",
  },
  primaryActionBtn: {
    backgroundColor: colors.primary,
    height: 50,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  primaryActionBtnSmall: {
    backgroundColor: colors.primary,
    height: 46,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  primaryActionBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  secondaryBtn: {
    height: 46,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  secondaryBtnText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  bottomNavRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  refInfoCard: {
    backgroundColor: "#F9FAFB",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 16,
  },
  refInfoLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: colors.primary,
    letterSpacing: 0.5,
  },
  refInfoName: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
    marginTop: 2,
  },
  refInfoNature: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  refInfoRef: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    marginTop: 4,
  },
  rowTwoCols: {
    flexDirection: "row",
    gap: 12,
  },
  addPartnerBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  addPartnerBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  proprietorCard: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
    overflow: "hidden",
  },
  proprietorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#F9FAFB",
  },
  proprietorHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  avatarPill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  proprietorName: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },
  proprietorSub: {
    fontSize: 11,
    color: colors.textMuted,
  },
  proprietorHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  removeIconBtn: {
    padding: 4,
  },
  proprietorBody: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  phoneInputRow: {
    flexDirection: "row",
  },
  countryCodeBtn: {
    height: 48,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderRightWidth: 0,
    borderColor: "#E5E7EB",
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  countryCodeText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  genderRow: {
    flexDirection: "row",
    gap: 8,
  },
  genderPill: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  genderPillActive: {
    borderColor: colors.primary,
    backgroundColor: "#EFF6FF",
  },
  genderPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
  },
  genderPillTextActive: {
    color: colors.primary,
  },
  minorNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    padding: 10,
    borderRadius: 8,
    gap: 8,
    marginBottom: 12,
  },
  minorNoticeText: {
    fontSize: 11,
    color: "#92400E",
    flex: 1,
    lineHeight: 16,
  },
  docProprietorSection: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  docProprietorTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 12,
  },
  uploadBox: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    backgroundColor: "#FFFFFF",
  },
  uploadBoxHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  uploadBoxTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  uploadBoxSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  viewDocLink: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },
  uploadSlotTrigger: {
    height: 44,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.primary,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  uploadSlotText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },
  uploadedStateRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  uploadedFileName: {
    fontSize: 12,
    fontWeight: "700",
    color: "#166534",
    flex: 1,
  },
  replaceBtn: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  replaceBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#166534",
  },
  summaryCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 14,
  },
  summaryCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingBottom: 6,
  },
  summaryCardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },
  summaryEditLink: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "600",
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
    textAlign: "right",
    flex: 1,
    marginLeft: 8,
  },
  propSummaryItem: {
    paddingVertical: 6,
  },
  propSummaryItemBorder: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    marginTop: 6,
    paddingTop: 8,
  },
  propSummaryName: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
  },
  propSummaryDetails: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  docsSummaryPillRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
  },
  docStatusBadge: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  docStatusBadgeOk: {
    backgroundColor: "#DCFCE7",
  },
  docStatusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#166534",
  },
  tatCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    padding: 12,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    marginBottom: 8,
  },
  tatTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
  },
  tatText: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.primary,
    marginTop: 1,
  },
  pickerModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  pickerModalContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
  },
  pickerModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  pickerModalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  pickerModalSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  modalSearchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
    marginBottom: 12,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
  },
  pickerModalScroll: {
    maxHeight: 360,
  },
  pickerListItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F9FAFB",
  },
  pickerListItemActive: {
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
  },
  pickerListItemText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: "600",
    flex: 1,
  },
  pickerListItemTextActive: {
    color: colors.primary,
    fontWeight: "800",
  },
  imagePreviewBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  closePreviewBtn: {
    position: "absolute",
    top: 40,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  fullPreviewImage: {
    width: "90%",
    height: "75%",
  },
  checkoutModalContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  checkoutPricingBox: {
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  pricingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 4,
  },
  pricingLabel: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: "600",
  },
  pricingAmount: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
  },
  deficitBox: {
    backgroundColor: "#FEF2F2",
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
  },
  deficitText: {
    fontSize: 12,
    color: "#B91C1C",
    lineHeight: 18,
  },
  paymentActionsContainer: {
    gap: 10,
    marginTop: 4,
  },
  walletPayBtn: {
    backgroundColor: colors.primary,
    height: 50,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  walletPayBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  insufficientRow: {
    flexDirection: "row",
    gap: 10,
  },
  fundWalletBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFF6FF",
  },
  fundWalletBtnText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  payOnlineBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#10B981",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  payOnlineBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  payOnlineSecondaryBtn: {
    height: 46,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  payOnlineSecondaryBtnText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  btnDisabled: {
    opacity: 0.5,
  },
});

const dateStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  container: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    width: "100%",
    maxWidth: 340,
    padding: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: "center",
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: "#FFFFFF",
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
  },
  tabBtnTextActive: {
    color: colors.primary,
  },
  body: {
    height: 200,
  },
  scroll: {
    flex: 1,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    minWidth: 60,
    alignItems: "center",
  },
  pillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
  },
  pillTextActive: {
    color: "#FFFFFF",
  },
  footer: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    paddingTop: 10,
  },
  confirmBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  confirmBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
});
