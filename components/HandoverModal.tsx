// Author: Gemini
// OS support: Web/Node
// Description: Handover document modal component with PDF/Docx generation and itemized sample lists with search by other info

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  X,
  Plus,
  Trash2,
  MapPin,
  Phone,
  User,
  Truck,
  Building2,
  ArrowRightLeft,
  UserCheck,
  Camera,
  Image as ImageIcon,
  Sparkles,
  Loader2,
  FileDown,
  ChevronDown,
  Printer,
  Search,
  Filter,
  FileText,
  Calendar as CalendarIcon,
  RotateCcw,
  ScanLine,
  FileSignature,
  Save,
  Eye,
  Info,
  AlertOctagon,
  AlertCircle,
  FileSpreadsheet,
  Globe,
  Edit,
} from "lucide-react";
import { toast } from "sonner";
import {
  HandoverType,
  HandoverDoc,
  TestRequest,
  SampleStatus,
  MachineType,
  RequestStatus,
  PriorityLevel,
  LAB_METADATA,
  CustomerRef,
  TestCategory,
  LAB_CONSTANTS,
} from "../types";
import {
  generateSequenceCode,
  removeAccents,
  formatPhoneNumber,
} from "../utils/formatter";
import { fileToGenerativePart, extractRequestsFromFile } from "../utils/gemini";
import { searchCustomers, searchBrands } from "../utils/referenceData";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import FileSaver from "file-saver";
import { useStore } from "../store";
import { CustomDatePicker } from "./CustomDatePicker";
import { SearchableSelect } from "./SearchableSelect";

interface HandoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableRequests: TestRequest[];
  onSubmit: (doc: HandoverDoc) => void;
  onAddRequests: (reqs: TestRequest[]) => void;
  handoverDocs: HandoverDoc[];
  existingDoc?: HandoverDoc | null;
  initialRequestGroup?: TestRequest[] | null;
}

interface TempItem {
  id: string;
  modelName: string;
  brand: string;
  type: string;
  testCategory: TestCategory;
  quantity: number;
  unit: string;
  note: string;
  otherInfo?: string;
  ecnCode?: string;
  atdEncodeNumber?: string;
  itdEncodeNumber?: string;
  emcEncodeNumber?: string;
}

interface FormSectionProps {
  formData: any;
  setFormData: (data: any) => void;
  receiveMode?: "EXISTING" | "NEW";
  refCustomers?: CustomerRef[];
}

const CustomerFormSection = ({
  formData,
  setFormData,
  receiveMode,
  refCustomers = [],
  isViewOnly,
}: FormSectionProps & { isViewOnly?: boolean }) => {
  const [suggestions, setSuggestions] = useState<CustomerRef[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const COMMON_POSITIONS = [
    "Lái xe",
    "Nhân viên",
    "Kỹ thuật viên",
    "Trưởng phòng",
    "Phó phòng",
    "Giám đốc",
    "Thủ kho",
    "Giao nhận",
    "Quản lý",
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const updateCustomerList = (value: string) => {
    if (!value || String(value).trim().length === 0) {
      setSuggestions(refCustomers.slice(0, 50));
    } else {
      const results = searchCustomers(value, refCustomers);
      setSuggestions(results);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormData({ ...formData, customerName: val });
    updateCustomerList(val);
    setShowSuggestions(true);
  };

  const handleFocus = () => {
    updateCustomerList(formData.customerName);
    setShowSuggestions(true);
  };

  const toggleDropdown = () => {
    if (showSuggestions) setShowSuggestions(false);
    else {
      updateCustomerList(formData.customerName);
      setShowSuggestions(true);
    }
  };

  const selectCustomer = (c: CustomerRef) => {
    setFormData({
      ...formData,
      customerName: c.name,
      customerAddress: c.address || formData.customerAddress,
      customerPhone: formatPhoneNumber(c.phone) || formData.customerPhone,
      representative: c.contactPerson || formData.representative,
    });
    setShowSuggestions(false);
  };

  const clearCustomer = () => {
    setFormData({
      ...formData,
      customerName: "",
      customerAddress: "",
      customerPhone: "",
      representative: "",
    });
    updateCustomerList("");
    setShowSuggestions(true);
  };

  if (isViewOnly) {
    return (
      <div className="space-y-1.5 text-[11px] text-slate-700">
        <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
          <span className="text-[9px] font-bold text-slate-400 uppercase block">
            Đơn vị / Khách hàng
          </span>
          <span className="font-bold text-slate-800">
            {formData.customerName || "N/A"}
          </span>
        </div>
        {formData.customerAddress && (
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-start gap-1.5">
            <MapPin size={12} className="text-slate-400 mt-0.5 shrink-0" />
            <div>
              <span className="text-[9px] font-bold text-slate-400 uppercase block">
                Địa chỉ
              </span>
              <span className="font-medium">{formData.customerAddress}</span>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-1.5">
          {formData.representative && (
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
              <span className="text-[9px] font-bold text-slate-400 uppercase block">
                Đại diện / Chức vụ
              </span>
              <span className="font-semibold">
                {formData.representative}{" "}
                {formData.customerPosition
                  ? `(${formData.customerPosition})`
                  : ""}
              </span>
            </div>
          )}
          {formData.customerPhone && (
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-center gap-1.5">
              <Phone size={12} className="text-slate-400 shrink-0" />
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase block">
                  Số điện thoại
                </span>
                <span className="font-semibold">{formData.customerPhone}</span>
              </div>
            </div>
          )}
        </div>
        {(formData.driverName || formData.vehicleInfo) && (
          <div className="bg-orange-50/50 p-2 rounded-lg border border-orange-100/60 grid grid-cols-2 gap-1.5">
            {formData.driverName && (
              <div>
                <span className="text-[9px] font-bold text-orange-500 uppercase block">
                  Lái xe
                </span>
                <span className="font-semibold text-slate-800">
                  {formData.driverName}
                </span>
              </div>
            )}
            {formData.vehicleInfo && (
              <div>
                <span className="text-[9px] font-bold text-orange-500 uppercase block">
                  Biển số xe
                </span>
                <span className="font-semibold text-slate-800">
                  {formData.vehicleInfo}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2 relative" ref={wrapperRef}>
        <div className="relative">
          <input
            type="text"
            required={receiveMode === "NEW"}
            className="w-full border rounded-xl p-2.5 text-xs font-bold bg-white focus:ring-2 focus:ring-blue-500 outline-none pr-8"
            value={formData.customerName}
            onChange={handleChange}
            onFocus={handleFocus}
            placeholder="Tên đơn vị / Khách hàng *"
            autoComplete="off"
          />
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {formData.customerName && (
              <button
                type="button"
                onClick={clearCustomer}
                className="text-slate-300 hover:text-red-500 transition-colors p-1"
              >
                <X size={12} />
              </button>
            )}
            <button
              type="button"
              onClick={toggleDropdown}
              className="text-slate-400 hover:text-blue-600 transition-colors p-1"
            >
              <ChevronDown size={14} />
            </button>
          </div>
        </div>

        {showSuggestions && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-[60] overflow-hidden max-h-60 overflow-y-auto animate-in slide-in-from-top-2">
            {suggestions.length > 0 ? (
              suggestions.map((c, idx) => (
                <div
                  key={idx}
                  onClick={() => selectCustomer(c)}
                  className="p-2.5 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0 group"
                >
                  <div className="text-[11px] font-black text-slate-800 uppercase group-hover:text-blue-700">
                    {c.name}
                  </div>
                  {c.address && (
                    <div className="text-[9px] text-slate-500 truncate group-hover:text-blue-600 mt-0.5">
                      {c.address}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-3 text-center text-[10px] text-slate-400 italic">
                Không tìm thấy khách hàng
              </div>
            )}
          </div>
        )}
        <div className="relative">
          <MapPin
            size={12}
            className="absolute left-3 top-2.5 text-slate-400"
          />
          <input
            type="text"
            className="w-full border rounded-xl p-2.5 pl-8 text-[11px] font-medium bg-white outline-none"
            value={formData.customerAddress}
            onChange={(e) =>
              setFormData({ ...formData, customerAddress: e.target.value })
            }
            placeholder="Địa chỉ đơn vị"
          />
        </div>
      </div>
      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-2">
        <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-slate-500">
          <UserCheck size={10} /> Đại diện (Kỹ thuật/Pháp lý)
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            className="w-full border rounded-lg p-2 text-[11px] font-medium bg-white outline-none"
            value={formData.representative}
            onChange={(e) =>
              setFormData({ ...formData, representative: e.target.value })
            }
            placeholder="Họ tên đại diện"
          />

          <div className="relative">
            <input
              type="text"
              list="positions-list"
              className="w-full border rounded-lg p-2 text-[11px] font-medium bg-white outline-none"
              value={formData.customerPosition}
              onChange={(e) =>
                setFormData({ ...formData, customerPosition: e.target.value })
              }
              placeholder="Chức vụ"
            />
            <datalist id="positions-list">
              {COMMON_POSITIONS.map((pos) => (
                <option key={pos} value={pos} />
              ))}
            </datalist>
          </div>
        </div>
        <div className="relative">
          <Phone
            size={12}
            className="absolute left-2.5 top-2.5 text-slate-400"
          />
          <input
            type="text"
            className="w-full border rounded-lg p-2 pl-7 text-[11px] font-medium bg-white outline-none"
            value={formData.customerPhone}
            onChange={(e) =>
              setFormData({ ...formData, customerPhone: e.target.value })
            }
            placeholder="Số điện thoại liên hệ"
          />
        </div>
      </div>
      <div className="bg-orange-50 p-2.5 rounded-xl border border-orange-100 space-y-2">
        <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-orange-600">
          <Truck size={10} /> Vận chuyển / Lái xe
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            className="w-full border rounded-lg p-2 text-[11px] font-medium bg-white outline-none"
            value={formData.driverName}
            onChange={(e) =>
              setFormData({ ...formData, driverName: e.target.value })
            }
            placeholder="Tên lái xe"
          />
          <input
            type="text"
            className="w-full border rounded-lg p-2 text-[11px] font-medium bg-white outline-none"
            value={formData.vehicleInfo}
            onChange={(e) =>
              setFormData({ ...formData, vehicleInfo: e.target.value })
            }
            placeholder="Biển số xe"
          />
        </div>
      </div>
    </div>
  );
};

const LabFormSection = ({
  formData,
  setFormData,
  isViewOnly,
}: FormSectionProps & { isViewOnly?: boolean }) => {
  const { testers } = useStore();

  const validStaff = testers.filter(
    (t) =>
      t.name !== "Khác" &&
      t.name &&
      !(
        t.position &&
        (t.position.includes("Khách") ||
          t.position.includes("Đối tác") ||
          t.position.includes("Quan sát") ||
          t.position.includes("Guest"))
      ) &&
      t.name !== "Trần Hoàng Phương",
  );

  const safeLabRepIndex =
    formData.labRepIndex >= 0 && formData.labRepIndex < validStaff.length
      ? formData.labRepIndex
      : 0;

  const staff = validStaff[safeLabRepIndex];

  if (isViewOnly) {
    return (
      <div className="space-y-1.5 text-[11px] text-slate-700">
        <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
          <span className="text-[9px] font-bold text-slate-400 uppercase block">
            Phòng thử nghiệm
          </span>
          <span className="font-bold text-slate-800">{LAB_METADATA.name}</span>
        </div>
        {formData.labAddress && (
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
            <span className="text-[9px] font-bold text-slate-400 uppercase block">
              Địa chỉ kho/phòng
            </span>
            <span className="font-medium">{formData.labAddress}</span>
          </div>
        )}
        {staff && (
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 flex justify-between items-center">
            <div>
              <span className="text-[9px] font-bold text-slate-400 uppercase block">
                Đại diện phòng thử nghiệm
              </span>
              <span className="font-semibold text-slate-800">
                {staff.name} - {staff.position || "Nhân viên"}
              </span>
            </div>
            {staff.phone && (
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                SĐT: {staff.phone}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
        <div className="text-[9px] font-black uppercase text-emerald-600 mb-1">
          Đơn vị
        </div>
        <div className="text-xs font-bold text-slate-800">
          {LAB_METADATA.name}
        </div>
      </div>
      <div>
        <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">
          Địa chỉ kho/phòng
        </label>
        <select
          className="w-full border rounded-xl p-2.5 text-xs font-medium bg-white outline-none"
          value={formData.labAddress}
          onChange={(e) =>
            setFormData({ ...formData, labAddress: e.target.value })
          }
        >
          {LAB_METADATA.addresses.map((addr, idx) => (
            <option key={idx} value={addr}>
              {addr}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">
          Đại diện (PTN)
        </label>
        <select
          className="w-full border rounded-xl p-2.5 text-xs font-medium bg-white outline-none"
          value={safeLabRepIndex}
          onChange={(e) =>
            setFormData({ ...formData, labRepIndex: parseInt(e.target.value) })
          }
        >
          {validStaff.map((s, idx) => (
            <option key={idx} value={idx}>
              {s.name} - {s.position || "Nhân viên"}
            </option>
          ))}
        </select>
        <div className="text-[9px] text-slate-400 mt-1 pl-1 italic">
          SĐT: {staff?.phone || ""}
        </div>
      </div>
    </div>
  );
};

const SAMPLE_UNITS = ["Bộ", "Cái", "Chiếc", "Thùng", "Mét", "Cuộn", "Quả", "Khác"];

export const HandoverModal = ({
  isOpen,
  onClose,
  availableRequests,
  onSubmit,
  onAddRequests,
  handoverDocs,
  existingDoc,
  initialRequestGroup,
}: HandoverModalProps) => {
  const {
    requests,
    customers,
    brands,
    testers,
    products,
    updateRequestNote,
    currentUser,
  } = useStore();
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const isFormDisabled = !!existingDoc && !isEditing;
  const isAdmin = currentUser?.role === "admin";

  const combinedCustomers = React.useMemo(() => {
    const list = customers.map((c) => {
      let finalAddress = String(c.address || "").trim();
      let finalTaxId = String(c.taxId || "").trim();

      const isAddressTaxId =
        /^[\d\-\s]+$/.test(finalAddress) && finalAddress.length > 5;
      const isTaxIdAddress = /[a-zA-Z]/.test(finalTaxId);

      if (isAddressTaxId) {
        if (isTaxIdAddress) {
          const temp = finalAddress;
          finalAddress = finalTaxId;
          finalTaxId = temp;
        } else {
          finalTaxId = finalAddress;
          finalAddress = "";
        }
      } else if (!finalAddress && isTaxIdAddress) {
        finalAddress = finalTaxId;
        finalTaxId = "";
      }

      return { ...c, address: finalAddress, taxId: finalTaxId };
    });

    const seen = new Set(
      list.map((c) =>
        String(c.name || "")
          .toLowerCase()
          .trim(),
      ),
    );
    requests.forEach((req) => {
      const nameLower = String(req.customerName || "")
        .toLowerCase()
        .trim();
      if (req.customerName && !seen.has(nameLower)) {
        seen.add(nameLower);
        let finalAddress = String(req.address || "").trim();
        let finalTaxId = String(req.taxId || "").trim();

        const isAddressTaxId =
          /^[\d\-\s]+$/.test(finalAddress) && finalAddress.length > 5;
        const isTaxIdAddress = /[a-zA-Z]/.test(finalTaxId);

        if (isAddressTaxId) {
          if (isTaxIdAddress) {
            const temp = finalAddress;
            finalAddress = finalTaxId;
            finalTaxId = temp;
          } else {
            finalTaxId = finalAddress;
            finalAddress = "";
          }
        } else if (!finalAddress && isTaxIdAddress) {
          finalAddress = finalTaxId;
          finalTaxId = "";
        }

        list.push({
          name: req.customerName,
          address: finalAddress,
          phone: req.phone || "",
          contactPerson: req.contactPerson || "",
          taxId: finalTaxId,
          email: req.email || "",
        });
      }
    });
    return list;
  }, [customers, requests]);

  const [formData, setFormData] = useState({
    type: HandoverType.RECEIVE,
    customerName: "",
    customerAddress: "",
    customerPhone: "",
    representative: "",
    customerPosition: "",
    driverName: "",
    vehicleInfo: "",
    customerSigner: "representative" as "representative" | "driver",
    labAddress: LAB_METADATA.addresses[0],
    labRepIndex: 0,
    date: new Date().toISOString().split("T")[0],
    selectedSamples: [] as string[],
  });

  const [receiveMode, setReceiveMode] = useState<"EXISTING" | "NEW">(
    "EXISTING",
  );
  const [manualDocNumber, setManualDocNumber] = useState("");
  const [manualRequestCode, setManualRequestCode] = useState("");
  const [manualLot, setManualLot] = useState("");
  const [sampleSearchQuery, setSampleSearchQuery] = useState("");
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState("");
  const [selectedProductFilter, setSelectedProductFilter] = useState("");
  const [selectedEncodeTypeFilter, setSelectedEncodeTypeFilter] = useState("");
  const [tempItems, setTempItems] = useState<TempItem[]>([]);
  const [newItem, setNewItem] = useState({
    type: products.length > 0 ? products[0].name : "Điều hòa không khí",
    modelName: "",
    brand: "",
    quantity: 1,
    unit: "Bộ",
    note: "",
    otherInfo: "",
    isAtd: true,
    isItd: false,
    isEmc: false,
  });

  const [brandSuggestions, setBrandSuggestions] = useState<string[]>([]);
  const [showBrandSuggestions, setShowBrandSuggestions] = useState(false);
  const brandWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        brandWrapperRef.current &&
        !brandWrapperRef.current.contains(event.target as Node)
      ) {
        setShowBrandSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleBrandChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewItem((prev) => ({ ...prev, brand: value }));
    if (String(value).trim().length > 0) {
      const suggestions = searchBrands(value, brands);
      setBrandSuggestions(suggestions);
      setShowBrandSuggestions(true);
    } else {
      setBrandSuggestions(brands.slice(0, 10));
      setShowBrandSuggestions(true);
    }
  };

  const handleBrandFocus = () => {
    const value = newItem.brand;
    if (String(value).trim().length > 0) {
      const suggestions = searchBrands(value, brands);
      setBrandSuggestions(suggestions);
    } else {
      setBrandSuggestions(brands.slice(0, 10));
    }
    setShowBrandSuggestions(true);
  };

  const selectBrand = (brandName: string) => {
    setNewItem((prev) => ({ ...prev, brand: brandName }));
    setShowBrandSuggestions(false);
  };

  const handleAddBrandDirectly = (brandName: string) => {
    if (!brandName || String(brandName).trim() === "") return;
    const cleanBrand = String(brandName).trim();
    useStore.getState().addBrand(cleanBrand);
    setNewItem((prev) => ({ ...prev, brand: cleanBrand }));
    setShowBrandSuggestions(false);
    toast.success(`Đã thêm mới nhãn hiệu: "${cleanBrand}"`);
  };

  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});

  const [isScanning, setIsScanning] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsEditing(false);
      if (existingDoc) {
        const validStaff = testers.filter(
          (t) =>
            t.name !== "Khác" &&
            t.name &&
            !(
              t.position &&
              (t.position.includes("Khách") ||
                t.position.includes("Đối tác") ||
                t.position.includes("Quan sát") ||
                t.position.includes("Guest"))
            ) &&
            t.name !== "Trần Hoàng Phương",
        );
        const staffIndex = validStaff.findIndex(
          (s) => s.name === existingDoc.labRepresentative,
        );

        setFormData({
          type: existingDoc.type,
          customerName: existingDoc.customerName,
          customerAddress: existingDoc.customerAddress || "",
          customerPhone: existingDoc.customerPhone || "",
          representative: existingDoc.representative,
          customerPosition: existingDoc.customerPosition || "",
          driverName: existingDoc.driverName || "",
          vehicleInfo: existingDoc.vehicleInfo || "",
          customerSigner: existingDoc.driverName ? "driver" : "representative",
          labAddress: existingDoc.labAddress,
          labRepIndex: staffIndex !== -1 ? staffIndex : 0,
          date: existingDoc.date.split("T")[0],
          selectedSamples: existingDoc.sampleIds,
        });
        setManualDocNumber(existingDoc.docNumber);
        setReceiveMode("EXISTING");
        setTempItems([]);
      } else if (initialRequestGroup && initialRequestGroup.length > 0) {
        const today = new Date().toISOString().split("T")[0];
        const first = initialRequestGroup[0];

        const isAllInLabOrReturned = initialRequestGroup.every(
          (r) =>
            r.sampleStatus === SampleStatus.IN_LAB ||
            r.sampleStatus === SampleStatus.RETURNED,
        );
        const defaultType = isAllInLabOrReturned
          ? HandoverType.RETURN
          : HandoverType.RECEIVE;

        const initialSelectedSamples = initialRequestGroup
          .filter((r) =>
            defaultType === HandoverType.RECEIVE
              ? r.sampleStatus === SampleStatus.WAITING
              : r.sampleStatus === SampleStatus.IN_LAB,
          )
          .map((r) => r.id);

        const prefix =
          defaultType === HandoverType.RECEIVE ? "NM DDT" : "GM DDT";
        const dateObj = new Date(today);

        setFormData({
          type: defaultType,
          customerName: first.customerName || "",
          customerAddress: first.address || "",
          customerPhone: first.phone || "",
          representative: first.contactPerson || "",
          customerPosition: "",
          driverName: "",
          vehicleInfo: "",
          customerSigner: "representative",
          labAddress: LAB_METADATA.addresses[0],
          labRepIndex: 0,
          date: today,
          selectedSamples: initialSelectedSamples,
        });

        if (first.customerName) {
          setSelectedCustomerFilter(first.customerName);
        }

        setManualDocNumber(
          generateSequenceCode(prefix, handoverDocs, "docNumber", dateObj, " "),
        );
        setManualRequestCode(first.requestCode || "");
        setReceiveMode("EXISTING");
        setTempItems([]);
      } else {
        const today = new Date().toISOString().split("T")[0];
        setFormData({
          type: HandoverType.RECEIVE,
          customerName: "",
          customerAddress: "",
          customerPhone: "",
          representative: "",
          customerPosition: "",
          driverName: "",
          vehicleInfo: "",
          customerSigner: "representative",
          labAddress: LAB_METADATA.addresses[0],
          labRepIndex: 0,
          date: today,
          selectedSamples: [],
        });
        setReceiveMode("EXISTING");

        const prefix = "NM DDT";
        const dateObj = new Date(today);
        setManualDocNumber(
          generateSequenceCode(prefix, handoverDocs, "docNumber", dateObj, " "),
        );
        setManualRequestCode(
          generateSequenceCode("PYC-DDT", requests, "requestCode"),
        );
      }

      setSampleSearchQuery("");
      setSelectedCustomerFilter("");
      setSelectedProductFilter("");
      setSelectedEncodeTypeFilter("");
      setNewItem({
        type: products.length > 0 ? products[0].name : "Điều hòa không khí",
        modelName: "",
        brand: "",
        quantity: 1,
        unit: "Bộ",
        note: "",
        otherInfo: "",
        isAtd: true,
        isItd: false,
        isEmc: false,
      });
      setIsScanning(false);
      setIsExporting(false);
      setLocalNotes({});
    }
  }, [isOpen, existingDoc, initialRequestGroup]);

  useEffect(() => {
    if (!isOpen || existingDoc) return;
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === "file") {
          const file = items[i].getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) {
        
        
        if (
          target.tagName !== "INPUT" ||
          (target as HTMLInputElement).type !== "file"
        ) {
          e.preventDefault();
          handleProcessFiles(files);
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [isOpen, existingDoc]);

  useEffect(() => {
    if (isOpen && !existingDoc) {
      const prefix =
        formData.type === HandoverType.RECEIVE ? "NM DDT" : "GM DDT";
      const dateObj = new Date(formData.date);

      const code = generateSequenceCode(
        prefix,
        handoverDocs,
        "docNumber",
        dateObj,
        " ",
      );
      setManualDocNumber(code);
    }
  }, [formData.type, formData.date, isOpen, handoverDocs, existingDoc]);

  useEffect(() => {
    if (isOpen && !existingDoc && receiveMode === "NEW") {
      if (!manualRequestCode) {
        const code = generateSequenceCode("PYC-DDT", requests, "requestCode");
        setManualRequestCode(code);
      }
    }
  }, [receiveMode, isOpen, requests, existingDoc, manualRequestCode]);

  useEffect(() => {
    if (manualRequestCode) {
      const lotVal = manualRequestCode
        .replace("PYC-DDT-", "")
        .replace("PYC-", "")
        .replace("DDT-", "")
        .trim();
      setManualLot(lotVal);
    } else {
      setManualLot("");
    }
  }, [manualRequestCode]);

  const uniqueCustomersInCandidates = useMemo(() => {
    const targetStatus =
      formData.type === HandoverType.RECEIVE
        ? SampleStatus.WAITING
        : SampleStatus.IN_LAB;
    let list = availableRequests.filter(
      (req) => req.sampleStatus === targetStatus,
    );
    if (existingDoc) {
      const currentDocSamples = availableRequests.filter(
        (req) =>
          Array.isArray(existingDoc.sampleIds) &&
          existingDoc.sampleIds.includes(req.id),
      );
      const idSet = new Set(list.map((r) => r.id));
      currentDocSamples.forEach((r) => {
        if (!idSet.has(r.id)) list.push(r);
      });
    }
    const names = list.map((req) => req.customerName).filter(Boolean);
    return Array.from(new Set(names)).sort();
  }, [availableRequests, formData.type, existingDoc]);

  const handleTypeChange = (newType: HandoverType) => {
    if (formData.type === newType) return;

    let newSelected: string[] = [];
    if (initialRequestGroup && initialRequestGroup.length > 0) {
      newSelected = initialRequestGroup
        .filter((r) =>
          newType === HandoverType.RECEIVE
            ? r.sampleStatus === SampleStatus.WAITING
            : r.sampleStatus === SampleStatus.IN_LAB,
        )
        .map((r) => r.id);
    } else {
      newSelected = formData.selectedSamples.filter((id) => {
        const req = availableRequests.find((r) => r.id === id);
        if (!req) return false;
        return newType === HandoverType.RECEIVE
          ? req.sampleStatus === SampleStatus.WAITING
          : req.sampleStatus === SampleStatus.IN_LAB;
      });
    }

    setFormData((prev) => ({
      ...prev,
      type: newType,
      selectedSamples: newSelected,
    }));
  };

  const uniqueProductsInCandidates = useMemo(() => {
    const targetStatus =
      formData.type === HandoverType.RECEIVE
        ? SampleStatus.WAITING
        : SampleStatus.IN_LAB;
    let list = availableRequests.filter(
      (req) => req.sampleStatus === targetStatus,
    );
    if (existingDoc) {
      const currentDocSamples = availableRequests.filter(
        (req) =>
          Array.isArray(existingDoc.sampleIds) &&
          existingDoc.sampleIds.includes(req.id),
      );
      const idSet = new Set(list.map((r) => r.id));
      currentDocSamples.forEach((r) => {
        if (!idSet.has(r.id)) list.push(r);
      });
    }
    const types = list.map((req) => req.type).filter(Boolean);
    return Array.from(new Set(types)).sort();
  }, [availableRequests, formData.type, existingDoc]);

  const filteredSamples = useMemo(() => {
    const targetStatus =
      formData.type === HandoverType.RECEIVE
        ? SampleStatus.WAITING
        : SampleStatus.IN_LAB;
    let list = availableRequests.filter(
      (req) => req.sampleStatus === targetStatus,
    );

    if (existingDoc) {
      const currentDocSamples = availableRequests.filter(
        (req) =>
          Array.isArray(existingDoc.sampleIds) &&
          existingDoc.sampleIds.includes(req.id),
      );

      const idSet = new Set(list.map((r) => r.id));
      currentDocSamples.forEach((r) => {
        if (!idSet.has(r.id)) list.push(r);
      });
    }

    if (selectedCustomerFilter) {
      list = list.filter((req) => req.customerName === selectedCustomerFilter);
    }

    if (selectedProductFilter) {
      list = list.filter((req) => req.type === selectedProductFilter);
    }

    if (selectedEncodeTypeFilter) {
      if (selectedEncodeTypeFilter === "ITDC") {
        list = list.filter((req) => !!req.atdEncodeNumber);
      } else if (selectedEncodeTypeFilter === "ITD") {
        list = list.filter((req) => !!req.itdEncodeNumber);
      } else if (selectedEncodeTypeFilter === "EMC") {
        list = list.filter((req) => !!req.emcEncodeNumber);
      } else if (selectedEncodeTypeFilter === "NONE") {
        list = list.filter(
          (req) =>
            !req.atdEncodeNumber &&
            !req.itdEncodeNumber &&
            !req.emcEncodeNumber,
        );
      }
    }

    if (String(sampleSearchQuery).trim()) {
      const queryNormalized = removeAccents(
        String(sampleSearchQuery || "").toLowerCase().trim(),
      );
      const cleanQuery = queryNormalized.replace(/^(lô|lo)\s+/i, '');

      list = list.filter((req) => {
        const modelNameNormalized = removeAccents(
          String(req.modelName || "").toLowerCase(),
        );
        const requestCodeNormalized = removeAccents(
          String(req.requestCode || "").toLowerCase(),
        );
        const customerNameNormalized = removeAccents(
          String(req.customerName || "").toLowerCase(),
        );
        const brandNormalized = removeAccents(
          String(req.brand || "").toLowerCase(),
        );
        const atdEncodeNormalized = removeAccents(
          String(req.atdEncodeNumber || "").toLowerCase(),
        );
        const emcEncodeNormalized = removeAccents(
          String(req.emcEncodeNumber || "").toLowerCase(),
        );
        const itdEncodeNormalized = removeAccents(
          String(req.itdEncodeNumber || "").toLowerCase(),
        );
        const encodeNormalized = removeAccents(
          String(req.encodeNumber || "").toLowerCase(),
        );
        const typeNormalized = removeAccents(
          String(req.type || "").toLowerCase(),
        );
        const otherCustomerInfoNormalized = removeAccents(
          String(req.otherCustomerInfo || "").toLowerCase(),
        );
        const noteNormalized = removeAccents(
          String(req.note || "").toLowerCase(),
        );
        const specificationsNormalized = removeAccents(
          String(req.specifications || "").toLowerCase(),
        );

        const rawLot = req.encodeNumber || 
          [req.atdEncodeNumber, req.emcEncodeNumber, req.itdEncodeNumber]
            .map(e => e ? e.replace(/^(ATD|EMC|ITD|ITDC)\s+/i, '').replace(/-M\d+$/i, '') : '')
            .find(Boolean) || '';
        const lotNormalized = removeAccents(rawLot.toLowerCase());

        return (
          modelNameNormalized.includes(queryNormalized) ||
          requestCodeNormalized.includes(queryNormalized) || (cleanQuery !== "" && requestCodeNormalized.includes(cleanQuery)) ||
          customerNameNormalized.includes(queryNormalized) ||
          brandNormalized.includes(queryNormalized) ||
          atdEncodeNormalized.includes(queryNormalized) || (cleanQuery !== "" && atdEncodeNormalized.includes(cleanQuery)) ||
          emcEncodeNormalized.includes(queryNormalized) || (cleanQuery !== "" && emcEncodeNormalized.includes(cleanQuery)) ||
          itdEncodeNormalized.includes(queryNormalized) || (cleanQuery !== "" && itdEncodeNormalized.includes(cleanQuery)) ||
          encodeNormalized.includes(queryNormalized) || (cleanQuery !== "" && encodeNormalized.includes(cleanQuery)) ||
          typeNormalized.includes(queryNormalized) ||
          otherCustomerInfoNormalized.includes(queryNormalized) ||
          noteNormalized.includes(queryNormalized) ||
          specificationsNormalized.includes(queryNormalized) ||
          (lotNormalized !== "" && (lotNormalized.includes(queryNormalized) || (cleanQuery !== "" && lotNormalized.includes(cleanQuery))))
        );
      });
    }
    return list;
  }, [
    availableRequests,
    formData.type,
    sampleSearchQuery,
    existingDoc,
    selectedCustomerFilter,
    selectedProductFilter,
    selectedEncodeTypeFilter,
  ]);

  const getSafeLabStaff = () => {
    const validStaff = testers.filter(
      (t) =>
        t.name !== "Khác" &&
        t.name &&
        !(
          t.position &&
          (t.position.includes("Khách") ||
            t.position.includes("Đối tác") ||
            t.position.includes("Quan sát") ||
            t.position.includes("Guest"))
        ) &&
        t.name !== "Trần Hoàng Phương",
    );
    const idx = formData.labRepIndex;
    if (idx >= 0 && idx < validStaff.length) {
      return validStaff[idx];
    }
    return (
      validStaff[0] || {
        name: "Unknown",
        position: "",
        phone: "",
        shortName: "",
        colorClass: "",
      }
    );
  };

  const handleAddTempItem = () => {
    if (!String(newItem.modelName || "").trim()) {
      toast.warning("Vui lòng nhập tên model");
      return;
    }

    if (newItem.brand && String(newItem.brand || "").trim() !== "") {
      useStore.getState().addBrand(String(newItem.brand || "").trim());
    }

    const itemIndex = tempItems.length + 1;
    const mtt = `M${String(itemIndex).padStart(2, "0")}`;
    const lot = String(manualRequestCode || "")
      .replace("PYC-DDT-", "")
      .replace("PYC-", "")
      .replace("DDT-", "")
      .trim();

    const atdEncode = newItem.isAtd ? `ITDC ${lot}-${mtt}` : "";
    const itdEncode = newItem.isItd ? `ITD ${lot}-${mtt}` : "";
    const emcEncode = newItem.isEmc ? `EMC ${lot}-${mtt}` : "";

    let category = TestCategory.ATD;
    if ((newItem.isAtd || newItem.isItd) && newItem.isEmc) {
      category = TestCategory.BOTH;
    } else if (newItem.isEmc) {
      category = TestCategory.EMC;
    }

    const itemToAdd: TempItem = {
      id: `tmp-${Date.now()}`,
      modelName: newItem.modelName,
      brand: newItem.brand,
      type: newItem.type,
      testCategory: category,
      quantity: newItem.quantity,
      unit: newItem.unit || "Bộ",
      note: newItem.note,
      otherInfo: newItem.otherInfo,
      atdEncodeNumber: atdEncode,
      itdEncodeNumber: itdEncode,
      emcEncodeNumber: emcEncode,
    };

    setTempItems([...tempItems, itemToAdd]);
    setNewItem((prev) => ({
      ...prev,
      modelName: "",
      brand: "",
      quantity: 1,
      note: "",
      otherInfo: "",
    }));
  };

  const handleRemoveTempItem = (id: string) => {
    setTempItems(tempItems.filter((i) => i.id !== id));
  };

  const handleResetForm = () => {
    if (window.confirm("Bạn có chắc muốn làm mới toàn bộ form nhập liệu?")) {
      setTempItems([]);
      setFormData((prev) => ({
        ...prev,
        customerName: "",
        customerAddress: "",
        customerPhone: "",
        representative: "",
        customerPosition: "",
        driverName: "",
        vehicleInfo: "",
      }));
      setNewItem({
        type: products.length > 0 ? products[0].name : "Điều hòa không khí",
        modelName: "",
        brand: "",
        quantity: 1,
        unit: "Bộ",
        note: "",
        otherInfo: "",
        isAtd: true,
        isItd: false,
        isEmc: false,
      });
      toast.success("Đã làm mới form");
    }
  };

  const handleProcessFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    setIsScanning(true);
    const loadingToast = toast.loading("AI đang phân tích tài liệu...", {
      duration: Infinity,
    });

    try {
      const scanFiles = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const base64 = await fileToGenerativePart(file);
        const isWord =
          file.type ===
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
          file.name.endsWith(".docx");
        const mimeType =
          file.type ||
          (isWord
            ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            : "image/jpeg");
        scanFiles.push({ mimeType, data: base64 });
      }

      const extracted = await extractRequestsFromFile(
        scanFiles,
        brands,
        customers,
      );

      if (!formData.customerName && extracted.customerInfo.name) {
        setFormData((prev) => ({
          ...prev,
          customerName: extracted.customerInfo.name,
          customerAddress:
            extracted.customerInfo.address || prev.customerAddress,
          customerPhone: extracted.customerInfo.phone || prev.customerPhone,
        }));
      }

      if (extracted.samples && extracted.samples.length > 0) {
        if (formData.type === HandoverType.RECEIVE && receiveMode === "NEW") {
          const lot = String(manualRequestCode || "")
            .replace("PYC-DDT-", "")
            .replace("PYC-", "")
            .replace("DDT-", "")
            .trim();
          const newItems = extracted.samples.map((s, idx) => {
            const itemIndex = tempItems.length + idx + 1;
            const mtt = `M${String(itemIndex).padStart(2, "0")}`;
            return {
              id: `ai-${Date.now()}-${idx}`,
              modelName: s.modelName,
              brand: s.brand,
              type:
                s.type ||
                (products.length > 0 ? products[0].name : "Điều hòa không khí"),
              testCategory: TestCategory.ATD,
              quantity: s.quantity || 1,
              unit: "Bộ",
              note: s.specifications || "",
              atdEncodeNumber: `ITDC ${lot}-${mtt}`,
              itdEncodeNumber: "",
              emcEncodeNumber: "",
            };
          });
          newItems.forEach((item) => {
            if (item.brand && String(item.brand || "").trim() !== "") {
              useStore.getState().addBrand(String(item.brand || "").trim());
            }
          });
          setTempItems((prev) => [...prev, ...newItems]);
          toast.success(`Đã thêm ${newItems.length} mẫu từ tài liệu.`, {
            id: loadingToast,
          });
        } else {
          const targetStatus =
            formData.type === HandoverType.RECEIVE
              ? SampleStatus.WAITING
              : SampleStatus.IN_LAB;
          const candidates = availableRequests.filter(
            (r) => r.sampleStatus === targetStatus,
          );

          const matchedIds: string[] = [];
          let matchCount = 0;
          extracted.samples.forEach((s) => {
            const sModel = String(s.modelName || "")
              .replace(/[^a-zA-Z0-9]/g, "")
              .toLowerCase();
            if (!sModel) return;

            const matches = candidates.filter((r) => {
              const rModel = String(r.modelName || "")
                .replace(/[^a-zA-Z0-9]/g, "")
                .toLowerCase();
              const rCode = String(r.requestCode || "")
                .replace(/[^a-zA-Z0-9]/g, "")
                .toLowerCase();
              return rModel.includes(sModel) || rCode.includes(sModel);
            });

            matches.forEach((m) => {
              if (
                !formData.selectedSamples.includes(m.id) &&
                !matchedIds.includes(m.id)
              ) {
                matchedIds.push(m.id);
                matchCount++;
              }
            });
          });
          if (matchedIds.length > 0) {
            setFormData((prev) => ({
              ...prev,
              selectedSamples: [...prev.selectedSamples, ...matchedIds],
            }));
            toast.success(
              `Đã tự động chọn ${matchCount} mẫu phù hợp từ danh sách.`,
              { id: loadingToast },
            );
          } else {
            toast.info(
              `Tìm thấy ${extracted.samples.length} mẫu trong ảnh nhưng không khớp với danh sách hệ thống.`,
              { id: loadingToast },
            );
          }
        }
      } else {
        toast.info("AI không tìm thấy thông tin mẫu nào trong ảnh.", {
          id: loadingToast,
        });
      }
    } catch (err: any) {
      toast.error("Lỗi AI: " + err.message, { id: loadingToast });
    } finally {
      setIsScanning(false);
    }
  };

  const handleScanInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await handleProcessFiles(e.target.files);
    }
    e.target.value = "";
  };

  const prepareHandoverData = (docData: HandoverDoc, items: any[]) => {
    const d = new Date(docData.date);
    const dateStr = `Hà Nội, ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}`;
    const isReceive = docData.type === HandoverType.RECEIVE;
    const vehicleStr =
      docData.driverName || docData.vehicleInfo
        ? `Đơn vị vận chuyển: ${docData.driverName || "..."} / ${docData.vehicleInfo || "..."}`
        : "";
    const customerInfo = {
      ten: docData.customerName,
      diachi: docData.customerAddress || "",
      daidien: docData.representative || "....................",
      chucvu: docData.customerPosition || "....................",
      sdt: docData.customerPhone || "",
      xe: vehicleStr,
    };
    const labInfo = {
      ten: docData.labName,
      diachi: docData.labAddress,
      daidien: docData.labRepresentative,
      chucvu: docData.labRepPosition || "",
      sdt: docData.labRepPhone || "",
      xe: "",
    };
    const benGiao = isReceive ? customerInfo : labInfo;
    const benNhan = isReceive ? labInfo : customerInfo;
    const totalQty = items.reduce((acc, item) => acc + (item.quantity || 0), 0);
    const customerSignerName =
      formData.customerSigner === "driver"
        ? docData.driverName || "Lái xe"
        : docData.representative || "Đại diện";
    const nguoigiao = isReceive ? customerSignerName : labInfo.daidien;
    const nguoinhan = isReceive ? labInfo.daidien : customerSignerName;
    return {
      ngaythang: dateStr,
      so_bien_ban: docData.docNumber,
      bengiao_ten: benGiao.ten,
      bengiao_diachi: benGiao.diachi,
      bengiao_daidien: benGiao.daidien,
      bengiao_chucvu: benGiao.chucvu,
      bengiao_sdt: benGiao.sdt,
      bengiao_thong_tin_xe: benGiao.xe,
      bennhan_ten: benNhan.ten,
      bennhan_diachi: benNhan.diachi,
      bennhan_daidien: benNhan.daidien,
      bennhan_chucvu: benNhan.chucvu,
      bennhan_sdt: benNhan.sdt,
      bennhan_thong_tin_xe: benNhan.xe,
      mthu: items.map((item, idx) => {
        const userNote = localNotes[item.id] !== undefined ? localNotes[item.id] : (item.note || "");
        const parts: string[] = [];
        if (userNote && userNote.toString().trim() !== "") {
          parts.push(userNote.toString().trim());
        }
        if (item.requestCode && item.requestCode.toString().trim() !== "") {
          const reqCodeStr = `Số phiếu yêu cầu: ${item.requestCode.toString().trim()}`;
          if (!userNote.includes(item.requestCode)) {
            parts.push(reqCodeStr);
          }
        }
        const otherInfoVal = item.otherCustomerInfo || item.otherInfo;
        if (
          otherInfoVal &&
          otherInfoVal.toString().trim() !== ""
        ) {
          const otherInfoStr = `Thông tin khác: ${otherInfoVal.toString().trim()}`;
          if (!userNote.includes(otherInfoVal)) {
            parts.push(otherInfoStr);
          }
        }
        const encodes = [
          item.atdEncodeNumber,
          item.emcEncodeNumber,
          item.itdEncodeNumber,
        ].filter(Boolean);
        if (encodes.length > 0) {
          const encodeStr = `Mã hóa: ${encodes.join(", ")}`;
          if (!encodes.some(e => userNote.includes(e))) {
            parts.push(encodeStr);
          }
        }
        if (item.sealStamp && item.sealStamp.toString().trim() !== "") {
          const sealStr = `Tem niêm phong: ${item.sealStamp.toString().trim()}`;
          if (!userNote.includes(item.sealStamp)) {
            parts.push(sealStr);
          }
        }
        const finalGc = parts.join(" | ");

        return {
          tt: idx + 1,
          san_pham: item.type || "Máy điều hòa không khí",
          nhan_hieu: item.brand,
          model: item.modelName,
          slg: (item.quantity || 1).toString().padStart(2, "0"),
          dvt: item.unit || "Bộ",
          gc: finalGc,
        };
      }),
      tcong: totalQty.toString().padStart(2, "0"),
      dvt: items.length > 0 ? items[0].unit || "Bộ" : "Bộ",
      nguoigiao: nguoigiao,
      nguoinhan: nguoinhan,
      tem_niem_phong:
        Array.from(
          new Set(
            items
              .map((s) =>
                s.sealStamp ? s.sealStamp.replace(/-M\d+$/i, "") : "",
              )
              .filter(Boolean),
          ),
        ).join(", ") || "",
    };
  };

  const handlePrint = (docData: HandoverDoc, items: any[]) => {
    const data = prepareHandoverData(docData, items);
    const printWindow = window.open("", "", "height=800,width=900");
    if (!printWindow) {
      toast.error("Trình duyệt đã chặn cửa sổ in. Vui lòng cho phép popup.");
      return;
    }
    const rowsHtml = data.mthu
      .map(
        (item) => `
          <tr>
              <td style="text-align:center; vertical-align: middle;">${item.tt}</td>
              <td style="text-align:left; padding: 5px 10px;">
                  <div style="margin-bottom: 3px;">Sản phẩm: ${item.san_pham}</div>
                  <div style="margin-bottom: 3px;">Nhãn hiệu: ${item.nhan_hieu}</div>
                  <div>Model: <b>${item.model}</b></div>
              </td>
              <td style="text-align:center; vertical-align: middle;">${item.slg}</td>
              <td style="text-align:center; vertical-align: middle;">${item.dvt}</td>
              <td style="text-align:center; vertical-align: middle;">${item.gc}</td>
          </tr>
      `,
      )
      .join("");
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Biên bản giao nhận</title>
            <style>
                @page { size: A4; margin: 20mm 15mm 20mm 20mm; }
                body { margin: 0; padding: 0; background: #ccc; font-family: 'Times New Roman', Times, serif; }
                .page { width: 210mm; min-height: 297mm; padding: 20mm 15mm 20mm 20mm; margin: 10mm auto; background: white; font-size: 13pt; line-height: 1.3; box-sizing: border-box; }
                @media print { body { background: white; } .page { margin: 0; padding: 0; box-shadow: none; width: 100%; min-height: auto; } }
                .header-table { width: 100%; margin-bottom: 20px; border-collapse: collapse; }
                .header-table td { vertical-align: top; text-align: center; padding: 0; }
                .title { text-align: center; font-weight: bold; font-size: 16pt; margin-top: 30px; margin-bottom: 5px; }
                .so-bb { text-align: center; font-style: italic; margin-bottom: 20px; font-size: 13pt; }
                .section-title { font-weight: bold; margin-top: 15px; margin-bottom: 5px; text-transform: uppercase; }
                .info-row { margin-bottom: 5px; }
                table.data-table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 13pt; }
                table.data-table th, table.data-table td { border: 1px solid black; padding: 5px 5px; vertical-align: middle; }
                table.data-table th { font-weight: bold; text-align: center; white-space: nowrap; text-transform: uppercase; }
                .footer-table { width: 100%; margin-top: 30px; border-collapse: collapse; }
                .footer-table td { text-align: center; vertical-align: top; width: 50%; }
                .sign-title { font-weight: bold; text-transform: uppercase; margin-bottom: 5px; }
                .sign-note { font-style: italic; font-size: 12pt; margin-bottom: 80px; }
                .signer-name { font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="page">
                <table class="header-table">
                    <tr>
                        <td style="width: 50%; vertical-align: top; padding-right: 15px;">
                            <div style="font-size: 11pt; font-weight: bold; line-height: 1.3; white-space: nowrap;">VIỆN CƠ KHÍ NĂNG LƯỢNG VÀ MỎ - VINACOMIN<br>TRUNG TÂM THỬ NGHIỆM - KIỂM ĐỊNH CÔNG NGHIỆP<br>PHÒNG THỬ NGHIỆM ĐIỆN - ĐIỆN TỬ<br>---***---</div>
                        </td>
                        <td style="width: 50%; vertical-align: top; padding-left: 15px;">
                            <div style="font-size: 11pt; font-weight: bold; line-height: 1.3; white-space: nowrap;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM<br>Độc lập – Tự do – Hạnh phúc<br>---o0o---</div>
                            <i style="font-size: 11pt; display: block; text-align: right; margin-top: 15px;">${data.ngaythang}</i>
                        </td>
                    </tr>
                </table>
                <div class="title">BIÊN BẢN GIAO NHẬN THIẾT BỊ</div>
                <div class="so-bb">SỐ: ${data.so_bien_ban}</div>
                <div class="section-title">I. BÊN A (BÊN GIAO): ${data.bengiao_ten}</div>
                <div class="info-row">Địa chỉ: ${data.bengiao_diachi}</div>
                <table style="width: 100%; border-collapse: collapse;"><tr><td style="width: 60%">Đại diện: ${data.bengiao_daidien}</td><td style="width: 40%">Chức vụ: ${data.bengiao_chucvu}</td></tr></table>
                <div class="info-row">Điện thoại: ${data.bengiao_sdt}</div>
                ${data.bengiao_thong_tin_xe ? `<div class="info-row">${data.bengiao_thong_tin_xe}</div>` : ""}
                <div class="section-title">II. BÊN B (BÊN NHẬN): ${data.bennhan_ten}</div>
                <div class="info-row">Địa chỉ: ${data.bennhan_diachi}</div>
                <table style="width: 100%; border-collapse: collapse;"><tr><td style="width: 60%">Đại diện: ${data.bennhan_daidien}</td><td style="width: 40%">Chức vụ: ${data.bennhan_chucvu}</td></tr></table>
                <div class="info-row">Điện thoại: ${data.bennhan_sdt}</div>
                ${data.bennhan_thong_tin_xe ? `<div class="info-row">${data.bennhan_thong_tin_xe}</div>` : ""}
                <div style="margin-top: 15px;">Bên A đã giao cho Bên B số lượng mẫu theo bảng sau:</div>
                <table class="data-table"><thead><tr><th style="width: 40px;">STT</th><th>TÊN MẪU THỬ</th><th style="width: 50px;">SL</th><th style="width: 60px;">ĐVT</th><th>GHI CHÚ</th></tr></thead><tbody>${rowsHtml}</tbody></table>
                <div>Tổng cộng: ${data.tcong} ${data.dvt}.</div>
                <div style="margin-top: 5px; text-align: justify;">Sau khi bàn giao, bên B chịu trách nhiệm hoàn toàn về bảo lưu mẫu, tất cả các hỏng hóc hay sự cố phát sinh sau này về mẫu thử nghiệm không thuộc trách nhiệm của bên A.</div>
                <div style="margin-top: 5px;">Biên bản được lập thành 02 bản, mỗi bên giữ 01 bản.</div>
                <table class="footer-table"><tr><td><div class="sign-title">ĐẠI DIỆN BÊN GIAO</div><div class="sign-note">(Ký, ghi rõ họ tên)</div><div class="signer-name">${data.nguoigiao}</div></td><td><div class="sign-title">ĐẠI DIỆN BÊN NHẬN</div><div class="sign-note">(Ký, ghi rõ họ tên)</div><div class="signer-name">${data.nguoinhan}</div></td></tr></table>
            </div>
        </body>
        </html>
      `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const handleExportHandover = async (docData: HandoverDoc, items: any[]) => {
    setIsExporting(true);
    try {
      const response = await fetch("/GiaoNhanMau.docx");
      if (!response.ok) return;
      const content = await response.arrayBuffer();
      const zip = new PizZip(content);
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: () => "",
      });
      const dataToRender = prepareHandoverData(docData, items);
      doc.render(dataToRender);
      const out = doc
        .getZip()
        .generate({
          type: "blob",
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });
      const safeCustomerName = docData.customerName.replace(
        /[\/\\:*?"<>|]/g,
        "",
      );
      const fileName = `${docData.docNumber} - ${safeCustomerName}.docx`;
      if ("showSaveFilePicker" in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: fileName,
            types: [
              {
                description: "Word Document",
                accept: {
                  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
                    [".docx"],
                },
              },
            ],
          });
          const writable = await handle.createWritable();
          await writable.write(out);
          await writable.close();
          toast.success("Đã lưu biên bản thành công!");
        } catch (err: any) {
          if (err.name !== "AbortError") {
            FileSaver.saveAs(out, fileName);
            toast.success("Đã tải xuống biên bản!");
          }
        }
      } else {
        FileSaver.saveAs(out, fileName);
        toast.success("Đã tải xuống biên bản!");
      }
    } catch (error: any) {
      toast.error(`Lỗi xuất file Word: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const prepareDocData = (): {
    doc: HandoverDoc;
    items: any[];
    newRequests?: TestRequest[];
  } | null => {
    const selectedStaff = getSafeLabStaff();
    const prefix = formData.type === HandoverType.RECEIVE ? "NM DDT" : "GM DDT";
    const dateObj = new Date(formData.date);
    const nextCode =
      manualDocNumber ||
      generateSequenceCode(prefix, handoverDocs, "docNumber", dateObj, " ");

    const docNumberToCheck = nextCode.trim().toLowerCase();
    const isDocNumberDup = handoverDocs.some((doc) => {
      if (existingDoc && doc.id === existingDoc.id) {
        return false;
      }
      return doc.docNumber.trim().toLowerCase() === docNumberToCheck;
    });

    if (isDocNumberDup) {
      toast.error(`Số biên bản "${nextCode.trim()}" đã tồn tại! Vui lòng nhập số khác.`);
      return null;
    }

    const baseDoc = {
      id: existingDoc ? existingDoc.id : `h-${Date.now()}`,
      docNumber: nextCode,
      type: formData.type,
      date: formData.date,
      customerName: formData.customerName,
      customerAddress: formData.customerAddress,
      customerPhone: formatPhoneNumber(formData.customerPhone),
      representative: formData.representative,
      customerPosition: formData.customerPosition,
      driverName: formData.driverName,
      vehicleInfo: formData.vehicleInfo,
      labName: LAB_METADATA.name,
      labAddress: formData.labAddress,
      labRepresentative: selectedStaff.name,
      labRepPosition: selectedStaff.position || "Nhân viên",
      labRepPhone: formatPhoneNumber(selectedStaff.phone || ""),
      status: "Signed" as const,
    };

    if (
      formData.type === HandoverType.RETURN ||
      (formData.type === HandoverType.RECEIVE && receiveMode === "EXISTING")
    ) {
      if (formData.selectedSamples.length === 0) {
        toast.warning("Vui lòng chọn mẫu!");
        return null;
      }

      if (formData.type === HandoverType.RETURN) {
        for (const sampleId of formData.selectedSamples) {
          const req = availableRequests.find((r) => r.id === sampleId);
          if (req) {
            const isCompleted =
              req.status === RequestStatus.COMPLETED ||
              req.status === RequestStatus.RESULTS_APPROVED ||
              req.status === RequestStatus.RESULTS_SUBMITTED ||
              !!req.endDate;
            const isFailed =
              req.status === RequestStatus.REQ_SUPPLEMENT ||
              (req.retryCount !== undefined && req.retryCount > 0);
            const isUntested = !isCompleted && !isFailed;

            if (isUntested) {
              const defaultNote = req.note || "";
              const currentNote =
                localNotes[sampleId] !== undefined
                  ? localNotes[sampleId]
                  : defaultNote;
              if (!String(currentNote).trim()) {
                toast.warning(
                  `Mẫu chưa thử nghiệm [${req.modelName}] bắt buộc phải ghi rõ nguyên nhân khi trả!`,
                );
                return null;
              }
            }
          }
        }
      }

      const targetStatus =
        formData.type === HandoverType.RECEIVE
          ? SampleStatus.WAITING
          : SampleStatus.IN_LAB;

      const validSelectedSamples = existingDoc
        ? formData.selectedSamples
        : formData.selectedSamples.filter((id) => {
            const req = availableRequests.find((r) => r.id === id);
            return req && req.sampleStatus === targetStatus;
          });

      if (validSelectedSamples.length === 0) {
        toast.warning(
          formData.type === HandoverType.RECEIVE
            ? "Vui lòng chọn ít nhất một mẫu chờ nhận!"
            : "Vui lòng chọn ít nhất một mẫu trong phòng thử nghiệm để trả!",
        );
        return null;
      }

      const items = availableRequests.filter((req) =>
        validSelectedSamples.includes(req.id),
      );
      return {
        doc: { ...baseDoc, sampleIds: validSelectedSamples },
        items,
      };
    }

    if (formData.type === HandoverType.RECEIVE && receiveMode === "NEW") {
      if (tempItems.length === 0) {
        toast.warning("Vui lòng thêm ít nhất một mẫu!");
        return null;
      }
      if (!String(formData.customerName).trim()) {
        toast.warning("Vui lòng nhập tên khách hàng!");
        return null;
      }

      const newRequestCode = String(manualRequestCode).trim() || generateSequenceCode("PYC-DDT", requests, "requestCode");
      const codeToCheck = newRequestCode.trim().toLowerCase();
      const lotToCheck = String(manualLot || "").trim().toLowerCase();

      const isCodeExists = requests.some(r => r.requestCode.trim().toLowerCase() === codeToCheck);
      if (isCodeExists) {
        toast.error(`Số phiếu yêu cầu "${newRequestCode}" đã tồn tại! Vui lòng sửa lại số khác.`);
        return null;
      }

      const isLotExists = requests.some(r => {
        const encodes = [r.atdEncodeNumber, r.itdEncodeNumber, r.emcEncodeNumber].filter(Boolean);
        return encodes.some(enc => enc.toLowerCase().includes(lotToCheck));
      });
      if (isLotExists && lotToCheck) {
        toast.error(`Số lô "${manualLot}" đã tồn tại! Vui lòng sửa lại số khác.`);
        return null;
      }

      const newRequests: TestRequest[] = [];
      const newRequestIds: string[] = [];
      const totalLotDays = 20;

      tempItems.forEach((item, index) => {
        if (item.brand && String(item.brand || "").trim() !== "") {
          useStore.getState().addBrand(String(item.brand || "").trim());
        }
        const reqId = `r-auto-${Date.now()}-${index}`;
        newRequestIds.push(reqId);

        const matchedProduct = products.find((p) => p.name === item.type);
        const testTimeEMC = matchedProduct?.testTimeEMC || 0;
        const testTimeATD = matchedProduct?.testTimeATD || 0;

        newRequests.push({
          id: reqId,
          requestCode: newRequestCode,
          modelName: item.modelName,
          brand: item.brand,
          type: item.type,
          testCategory: item.testCategory,
          quantity: item.quantity,
          unit: item.unit || "Bộ",
          customerName: formData.customerName,
          address: formData.customerAddress,
          phone: formData.customerPhone,
          contactPerson: formData.representative,
          status: RequestStatus.PENDING,
          sampleStatus: SampleStatus.WAITING,
          priority: PriorityLevel.NORMAL,
          requestDate: formData.date,
          receivedDate: formData.date,
          scheduledDate: null,
          testTimeEMC: testTimeEMC,
          testTimeATD: testTimeATD,
          duration: totalLotDays,
          totalLotDays: totalLotDays,
          specifications: "220V~ 50Hz",
          note: item.note,
          atdEncodeNumber: item.atdEncodeNumber || "",
          itdEncodeNumber: item.itdEncodeNumber || "",
          emcEncodeNumber: item.emcEncodeNumber || "",
          ecnCode: "",
          isNewSampleNoPYC: true,
        });
      });

      const itemsWithRequestCode = tempItems.map((item) => ({
        ...item,
        requestCode: newRequestCode,
      }));

      return {
        doc: { ...baseDoc, sampleIds: newRequestIds },
        items: itemsWithRequestCode,
        newRequests,
      };
    }
    return null;
  };

  const handleSaveOnly = () => {
    const data = prepareDocData();
    if (!data) return;

    if (data.newRequests) {
      onAddRequests(data.newRequests);
      toast.success(
        `Đã tạo phiếu yêu cầu mới: ${data.newRequests[0].requestCode}`,
      );
    } else {
      if (
        formData.type === HandoverType.RETURN ||
        (formData.type === HandoverType.RECEIVE && receiveMode === "EXISTING")
      ) {
        formData.selectedSamples.forEach((sampleId) => {
          if (localNotes[sampleId] !== undefined) {
            updateRequestNote(sampleId, localNotes[sampleId]);
          }
        });
      }
    }

    onSubmit(data.doc);
    toast.success("Đã lưu biên bản thành công!");
    onClose();
  };

  const handleExportOnly = async () => {
    const data = prepareDocData();
    if (!data) return;

    if (data.newRequests) {
      onAddRequests(data.newRequests);
      toast.success(
        `Đã tạo phiếu yêu cầu mới: ${data.newRequests[0].requestCode}`,
      );
    } else {
      if (
        formData.type === HandoverType.RETURN ||
        (formData.type === HandoverType.RECEIVE && receiveMode === "EXISTING")
      ) {
        formData.selectedSamples.forEach((sampleId) => {
          if (localNotes[sampleId] !== undefined) {
            updateRequestNote(sampleId, localNotes[sampleId]);
          }
        });
      }
    }

    if (!existingDoc) {
      onSubmit(data.doc);
    }

    await handleExportHandover(data.doc, data.items);

    if (!existingDoc) {
      onClose();
    }
  };

  const handlePrintPreview = () => {
    const data = prepareDocData();
    if (!data) return;

    if (
      formData.type === HandoverType.RETURN ||
      (formData.type === HandoverType.RECEIVE && receiveMode === "EXISTING")
    ) {
      formData.selectedSamples.forEach((sampleId) => {
        if (localNotes[sampleId] !== undefined) {
          updateRequestNote(sampleId, localNotes[sampleId]);
        }
      });
    }

    handlePrint(data.doc, data.items);
  };

  if (!isOpen) return null;
  const isReceive = formData.type === HandoverType.RECEIVE;
  const partyALabel = isReceive
    ? "Bên Giao (Khách hàng)"
    : "Bên Giao (Phòng thử nghiệm)";
  const partyBLabel = isReceive
    ? "Bên Nhận (Phòng thử nghiệm)"
    : "Bên Nhận (Khách hàng)";

  const renderCustomerSignature = () => (
    <div className="relative">
      <select
        className="w-full p-2 border-b border-slate-300 bg-transparent text-sm font-bold text-slate-800 outline-none appearance-none cursor-pointer hover:bg-slate-100/50 transition-colors"
        value={formData.customerSigner}
        onChange={(e) =>
          setFormData({ ...formData, customerSigner: e.target.value as any })
        }
      >
        <option value="representative">
          {formData.representative || "Đại diện"}
        </option>
        {formData.driverName && (
          <option value="driver">{formData.driverName} (Lái xe)</option>
        )}
      </select>
      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
        {" "}
        <ChevronDown size={14} className="text-slate-400" />{" "}
      </div>
      <div className="text-[9px] text-slate-400 mt-1 italic font-normal text-left">
        Chọn người ký
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 z-[100] flex items-end md:items-center justify-center md:p-4 backdrop-blur-sm"
      onDragOver={(e) => {
        if (!existingDoc) {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(true);
        }
      }}
      onDragLeave={(e) => {
        if (!existingDoc) {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
        }
      }}
      onDrop={(e) => {
        if (!existingDoc) {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0)
            handleProcessFiles(e.dataTransfer.files);
        }
      }}
    >
      {isDragging && !existingDoc && (
        <div className="absolute inset-0 z-[200] bg-blue-500/20 backdrop-blur-sm border-4 border-dashed border-blue-500 flex flex-col items-center justify-center rounded-3xl m-4 pointer-events-none animate-in fade-in duration-200">
          <ImageIcon size={64} className="text-blue-500 mb-4 animate-bounce" />
          <h2 className="text-2xl font-black text-blue-600 uppercase tracking-wider drop-shadow-md">
            Thả tệp vào đây
          </h2>
          <p className="text-blue-600 font-bold mt-2 bg-white/50 px-4 py-1 rounded-full">
            AI sẽ phân tích ảnh/tài liệu của bạn
          </p>
        </div>
      )}
      <div
        className={`bg-white w-full md:w-[98vw] max-w-none h-[96vh] max-h-[calc(100dvh-1rem)] md:h-[98vh] md:max-h-[calc(100dvh-2rem)] rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col min-h-0 overflow-hidden animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-200`}
      >
        <div
          className={`p-3 md:p-4 flex justify-between items-center text-white shrink-0 ${isEditing ? "bg-amber-600" : existingDoc ? "bg-slate-800" : "bg-blue-600"}`}
        >
          <div>
            <h3 className="text-sm md:text-base font-black uppercase flex items-center gap-2">
              {isEditing ? (
                <Edit size={18} className="text-amber-200" />
              ) : existingDoc ? (
                <Eye size={18} className="text-blue-400" />
              ) : null}
              {isEditing ? "Chỉnh sửa Biên bản" : existingDoc ? "Chi tiết Biên bản" : "Biên bản Giao nhận"}
            </h3>
            <p className="text-[9px] md:text-[10px] font-medium text-slate-300">
              {isEditing
                ? "Đang cập nhật nội dung biên bản"
                : existingDoc
                  ? "Xem lại thông tin và in ấn"
                  : "Giao nhận thiết bị thử nghiệm"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-full transition-all"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden bg-slate-100/80">
            {/* Cột trái: Thông tin chung & Các bên */}
            <div className="w-full md:w-[350px] lg:w-[400px] shrink-0 border-b md:border-b-0 md:border-r border-slate-200 bg-white flex flex-col md:overflow-y-auto p-3 space-y-3">
            <div className="bg-indigo-50 p-3 md:p-4 rounded-xl shadow-sm border border-indigo-200">
              {!existingDoc && (
                <div className="flex bg-slate-100 p-1 rounded-2xl mb-3">
                  <button
                    type="button"
                    onClick={() => handleTypeChange(HandoverType.RECEIVE)}
                    className={`flex-1 py-1.5 rounded-xl text-[11px] font-black transition-all ${formData.type === HandoverType.RECEIVE ? "bg-white text-blue-600 shadow-md" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    Nhận mẫu (Khách gửi)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTypeChange(HandoverType.RETURN)}
                    className={`flex-1 py-1.5 rounded-xl text-[11px] font-black transition-all ${formData.type === HandoverType.RETURN ? "bg-white text-blue-600 shadow-md" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    Trả mẫu (Khách nhận)
                  </button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div>
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    <FileText size={12} className="text-blue-500" />
                    <label className="text-[9px] font-black text-slate-500 uppercase">
                      Số Biên Bản (NM/GM)
                    </label>
                  </div>
                  <input
                    type="text"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                    value={manualDocNumber}
                    onChange={(e) => setManualDocNumber(e.target.value)}
                    placeholder="VD: NM 240523-01"
                    disabled={isFormDisabled}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    <CalendarIcon size={12} className="text-blue-500" />
                    <label className="text-[9px] font-black text-slate-500 uppercase">
                      Ngày giao nhận
                    </label>
                  </div>
                  <CustomDatePicker
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.date}
                    onChange={(val) => setFormData({ ...formData, date: val })}
                    disabled={isFormDisabled}
                  />
                </div>
              </div>

              {!existingDoc && formData.type === HandoverType.RECEIVE && (
                <div className="flex border-b border-slate-200 mt-2">
                  <button
                    type="button"
                    onClick={() => setReceiveMode("EXISTING")}
                    className={`mr-4 pb-1 text-[10px] md:text-xs font-black uppercase transition-all ${receiveMode === "EXISTING" ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-400"}`}
                  >
                    Theo PYC có sẵn
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceiveMode("NEW")}
                    className={`pb-1 text-[10px] md:text-xs font-black uppercase transition-all ${receiveMode === "NEW" ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-400"}`}
                  >
                    Mẫu mới (Chưa có PYC)
                  </button>
                </div>
              )}
            </div>
            <div
              className={`flex flex-col gap-4 relative bg-emerald-50 p-3 md:p-4 rounded-xl shadow-sm border border-emerald-200`}
            >
              <div className="hidden md:flex absolute left-8 -bottom-3 w-6 h-6 bg-slate-100 rounded-full items-center justify-center text-slate-400 border border-slate-200 z-10">
                <ArrowRightLeft size={10} className="rotate-90" />
              </div>
              <div
                className={`space-y-2 ${isReceive ? "" : "order-2 md:order-1"}`}
              >
                <h4 className="text-[10px] font-black text-slate-800 uppercase flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-lg">
                  {isReceive ? (
                    <User size={12} className="text-blue-600" />
                  ) : (
                    <Building2 size={12} className="text-emerald-600" />
                  )}
                  {partyALabel}
                </h4>
                {isReceive ? (
                  <CustomerFormSection
                    formData={formData}
                    setFormData={setFormData}
                    receiveMode={receiveMode}
                    refCustomers={combinedCustomers}
                    isViewOnly={isFormDisabled}
                  />
                ) : (
                  <LabFormSection
                    formData={formData}
                    setFormData={setFormData}
                    isViewOnly={isFormDisabled}
                  />
                )}
              </div>
              <div
                className={`space-y-2 ${isReceive ? "" : "order-1 md:order-2"}`}
              >
                <h4 className="text-[10px] font-black text-slate-800 uppercase flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-lg">
                  {!isReceive ? (
                    <User size={12} className="text-blue-600" />
                  ) : (
                    <Building2 size={12} className="text-emerald-600" />
                  )}
                  {partyBLabel}
                </h4>
                {!isReceive ? (
                  <CustomerFormSection
                    formData={formData}
                    setFormData={setFormData}
                    receiveMode={receiveMode}
                    refCustomers={combinedCustomers}
                    isViewOnly={isFormDisabled}
                  />
                ) : (
                  <LabFormSection
                    formData={formData}
                    setFormData={setFormData}
                    isViewOnly={isFormDisabled}
                  />
                )}
              </div>
            </div>
          </div>
            
            {/* Cột phải: Danh sách mẫu */}
            <div className="flex-1 flex flex-col md:overflow-hidden bg-slate-50">
              <div className="flex-1 md:overflow-y-auto p-3 md:p-4 space-y-3">
                {(formData.type === HandoverType.RETURN ||
              (formData.type === HandoverType.RECEIVE &&
                receiveMode === "EXISTING")) && (
              <div className="bg-amber-50 p-3 md:p-4 rounded-xl shadow-sm border border-amber-200">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {isFormDisabled
                        ? "Danh sách mẫu bàn giao"
                        : `Chọn mẫu (${formData.selectedSamples.length})`}
                    </label>
                    {!isFormDisabled &&
                      (() => {
                        const allFilteredSelected =
                          filteredSamples.length > 0 &&
                          filteredSamples.every((r) =>
                            formData.selectedSamples.includes(r.id),
                          );
                        return (
                          <button
                            type="button"
                            onClick={() => {
                              if (allFilteredSelected) {
                                const filteredIds = filteredSamples.map(
                                  (r) => r.id,
                                );
                                setFormData((prev) => ({
                                  ...prev,
                                  selectedSamples: prev.selectedSamples.filter(
                                    (id) => !filteredIds.includes(id),
                                  ),
                                }));
                              } else {
                                setFormData((prev) => {
                                  const newSelected = Array.from(
                                    new Set([
                                      ...prev.selectedSamples,
                                      ...filteredSamples.map((r) => r.id),
                                    ]),
                                  );
                                  return {
                                    ...prev,
                                    selectedSamples: newSelected,
                                    customerName:
                                      prev.customerName ||
                                      (filteredSamples.length > 0
                                        ? filteredSamples[0].customerName
                                        : prev.customerName),
                                  };
                                });
                              }
                            }}
                            className="text-[10px] bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-0.5 rounded transition-all font-bold"
                          >
                            {allFilteredSelected
                              ? "Bỏ chọn tất cả"
                              : "Chọn tất cả"}
                          </button>
                        );
                      })()}
                    {!isFormDisabled && (
                      <div className="flex gap-1">
                        <label
                          className={`flex items-center justify-center w-6 h-6 bg-blue-50 text-blue-600 rounded-lg cursor-pointer hover:bg-blue-100 transition-all ${isScanning ? "opacity-50 pointer-events-none" : ""}`}
                          title="Chụp ảnh tìm mẫu"
                        >
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            capture="environment"
                            onChange={handleScanInput}
                          />
                          <Camera size={14} />
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                {!isFormDisabled && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3 bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-sm items-end">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 block">
                        Tìm kiếm
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-slate-400">
                          <Search size={12} />
                        </span>
                        <input
                          type="text"
                          placeholder="Model, số PYC, lô, thông tin khác..."
                          value={sampleSearchQuery}
                          onChange={(e) => setSampleSearchQuery(e.target.value)}
                          className="w-full pl-7 pr-7 text-[11px] font-bold border border-slate-200 rounded-lg py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white transition-all text-slate-700 placeholder-slate-400"
                        />
                        {sampleSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setSampleSearchQuery("")}
                            className="absolute inset-y-0 right-0 flex items-center pr-2 text-slate-400 hover:text-slate-600 text-[10px] font-bold"
                          >
                            Xóa
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 block">
                        Khách hàng
                      </label>
                      <SearchableSelect
                        options={uniqueCustomersInCandidates}
                        value={selectedCustomerFilter}
                        onChange={setSelectedCustomerFilter}
                        placeholder="Tất cả khách hàng"
                        disabled={formData.selectedSamples.length > 0}
                        triggerClassName="w-full bg-white border border-slate-200 rounded-lg py-1.5 pl-2.5 pr-8 text-[11px] font-bold text-slate-700 outline-none cursor-pointer focus-within:ring-1 focus-within:ring-blue-500 flex items-center justify-between"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 block">
                        Loại sản phẩm
                      </label>
                      <SearchableSelect
                        options={uniqueProductsInCandidates}
                        value={selectedProductFilter}
                        onChange={setSelectedProductFilter}
                        placeholder="Tất cả loại sản phẩm"
                        triggerClassName="w-full bg-white border border-slate-200 rounded-lg py-1.5 pl-2.5 pr-8 text-[11px] font-bold text-slate-700 outline-none cursor-pointer focus-within:ring-1 focus-within:ring-blue-500 flex items-center justify-between"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1 block">
                        Loại mã hóa
                      </label>
                      <select
                        value={selectedEncodeTypeFilter}
                        onChange={(e) => setSelectedEncodeTypeFilter(e.target.value)}
                        className="w-full text-[11px] font-bold border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white transition-all text-slate-700"
                      >
                        <option value="">Tất cả</option>
                        <option value="ITDC">Đã mã hóa ITD-C</option>
                        <option value="ITD">Đã mã hóa ITD</option>
                        <option value="EMC">Đã mã hóa EMC</option>
                        <option value="NONE">Chưa mã hóa</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="max-h-[420px] overflow-y-auto border border-slate-200 rounded-xl bg-slate-50 relative">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100 sticky top-0 z-10 shadow-sm border-b border-slate-200">
                      <tr>
                        <th className="p-2 w-10 text-center">
                          <div className="flex items-center justify-center">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                              checked={
                                filteredSamples.length > 0 &&
                                filteredSamples.every((req) =>
                                  formData.selectedSamples.includes(req.id),
                                )
                              }
                              onChange={(e) => {
                                if (isFormDisabled) return;
                                const checked = e.target.checked;
                                if (checked) {
                                  if (!selectedCustomerFilter) {
                                    toast.warning("Vui lòng lọc theo khách hàng cụ thể trước khi chọn tất cả!");
                                    return;
                                  }
                                  const allIds = filteredSamples.map((r) => r.id);
                                  const uniqueIds = Array.from(
                                    new Set([
                                      ...formData.selectedSamples,
                                      ...allIds,
                                    ]),
                                  );
                                  setFormData((prev) => ({
                                    ...prev,
                                    selectedSamples: uniqueIds,
                                  }));
                                } else {
                                  const filteredIds = filteredSamples.map(
                                    (r) => r.id,
                                  );
                                  setFormData((prev) => {
                                    const nextSelected = prev.selectedSamples.filter(
                                      (id) => !filteredIds.includes(id),
                                    );
                                    if (nextSelected.length === 0) {
                                      setTimeout(() => setSelectedCustomerFilter(""), 0);
                                    }
                                    return {
                                      ...prev,
                                      selectedSamples: nextSelected,
                                    };
                                  });
                                }
                              }}
                              disabled={isFormDisabled}
                            />
                          </div>
                        </th>
                        <th className="p-2 text-[10px] font-bold text-slate-500 uppercase">
                          Mã Phiếu / Tên Mẫu
                        </th>
                        <th className="p-2 text-[10px] font-bold text-slate-500 uppercase">
                          Khách hàng
                        </th>
                        <th className="p-2 text-[10px] font-bold text-slate-500 uppercase">
                          Thông tin khác
                        </th>
                        <th className="p-2 text-[10px] font-bold text-slate-500 uppercase">
                          Mã Hóa
                        </th>
                        {formData.type === HandoverType.RETURN && (
                          <th className="p-2 text-[10px] font-bold text-slate-500 uppercase">
                            Trạng Thái
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {filteredSamples.map((req) => {
                        let defaultNote = req.note || "";
                        const uParts = [];
                        if (defaultNote.trim() !== "") {
                          uParts.push(defaultNote.trim());
                        }
                        if (req.requestCode && !defaultNote.includes(req.requestCode)) {
                          uParts.push(`Số phiếu yêu cầu: ${req.requestCode}`);
                        }
                        if (formData.type === HandoverType.RETURN) {
                          const encodes = [
                            req.atdEncodeNumber,
                            req.emcEncodeNumber,
                            req.itdEncodeNumber,
                          ].filter(Boolean);
                          const encodeStr = encodes.join(", ");
                          if (encodeStr && !defaultNote.includes(encodeStr)) {
                            uParts.push(`Mã hóa: ${encodeStr}`);
                          }
                        }
                        defaultNote = uParts.join(" | ");
                        const currentNote =
                          localNotes[req.id] !== undefined
                            ? localNotes[req.id]
                            : defaultNote;
                        const isSelected = formData.selectedSamples.includes(
                          req.id,
                        );

                        let isCompleted = false,
                          isFailed = false,
                          isUntested = false;
                        if (formData.type === HandoverType.RETURN) {
                          isCompleted =
                            req.status === RequestStatus.COMPLETED ||
                            req.status === RequestStatus.RESULTS_APPROVED ||
                            req.status === RequestStatus.RESULTS_SUBMITTED ||
                            !!req.endDate;
                          isFailed =
                            req.status === RequestStatus.REQ_SUPPLEMENT ||
                            (req.retryCount !== undefined && req.retryCount > 0);
                          isUntested = !isCompleted && !isFailed;
                        }

                        return (
                          <React.Fragment key={req.id}>
                            <tr
                              className={`transition-colors hover:bg-slate-50 ${isSelected ? "bg-blue-50/30" : ""}`}
                            >
                              <td className="p-2 text-center align-middle">
                                <input
                                  type="checkbox"
                                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    if (checked) {
                                      if (formData.selectedSamples.length === 0) {
                                        setSelectedCustomerFilter(req.customerName || "");
                                      } else {
                                        const firstSampleId = formData.selectedSamples[0];
                                        const firstSample = availableRequests.find((r) => r.id === firstSampleId);
                                        if (firstSample && firstSample.customerName !== req.customerName) {
                                          toast.error("Không được phép chọn mẫu của các công ty khác nhau!");
                                          return;
                                        }
                                      }
                                    } else {
                                      if (formData.selectedSamples.length === 1 && formData.selectedSamples.includes(req.id)) {
                                        setSelectedCustomerFilter("");
                                      }
                                    }
                                    setFormData((prev) => {
                                      const newSelected = checked
                                        ? [...prev.selectedSamples, req.id]
                                        : prev.selectedSamples.filter(
                                            (id) => id !== req.id,
                                          );
                                      let customerUpdates = {};
                                      if (
                                        checked &&
                                        (!prev.customerName ||
                                          String(prev.customerName).trim() ===
                                            "")
                                      ) {
                                        customerUpdates = {
                                          customerName:
                                            req.customerName || prev.customerName,
                                          customerAddress:
                                            req.address || prev.customerAddress,
                                          customerPhone:
                                            req.phone || prev.customerPhone,
                                          representative:
                                            req.contactPerson ||
                                            prev.representative,
                                        };
                                      }
                                      return {
                                        ...prev,
                                        selectedSamples: newSelected,
                                        ...customerUpdates,
                                      };
                                    });
                                  }}
                                  disabled={isFormDisabled}
                                />
                              </td>
                              <td className="p-2 align-middle">
                                <div className="font-bold text-slate-800 text-[11px] leading-tight mb-1">
                                  {req.modelName}
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  <span className="text-[9px] font-black bg-blue-100 text-blue-800 px-1 rounded uppercase">
                                    {req.requestCode}
                                  </span>
                                  {req.type && (
                                    <span className="text-[9px] font-bold bg-slate-100 text-slate-600 px-1 rounded uppercase">
                                      {req.type}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-2 align-middle">
                                <div className="text-[10px] text-slate-600 line-clamp-2">
                                  {req.customerName}
                                </div>
                              </td>
                              <td className="p-2 align-middle">
                                <div
                                  className="text-[10px] text-slate-600 line-clamp-2 font-medium"
                                  title={req.otherCustomerInfo || req.note || req.specifications || ""}
                                >
                                  {req.otherCustomerInfo || req.note || req.specifications || "—"}
                                </div>
                              </td>
                              <td className="p-2 align-middle">
                                <div className="flex flex-wrap gap-1">
                                  {req.atdEncodeNumber && (
                                    <span
                                      className="text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-1 rounded uppercase"
                                      title="ITDC"
                                    >
                                      {req.atdEncodeNumber}
                                    </span>
                                  )}
                                  {req.itdEncodeNumber && (
                                    <span
                                      className="text-[9px] font-black bg-purple-50 text-purple-700 border border-purple-200/60 px-1 rounded uppercase"
                                      title="ITD"
                                    >
                                      {req.itdEncodeNumber}
                                    </span>
                                  )}
                                  {req.emcEncodeNumber && (
                                    <span
                                      className="text-[9px] font-black bg-blue-50 text-blue-700 border border-blue-200/60 px-1 rounded uppercase"
                                      title="EMC"
                                    >
                                      {req.emcEncodeNumber}
                                    </span>
                                  )}
                                  {!req.atdEncodeNumber &&
                                    !req.itdEncodeNumber &&
                                    !req.emcEncodeNumber && (
                                      <span className="text-[9px] text-slate-400 italic">
                                        Chưa mã hóa
                                      </span>
                                    )}
                                </div>
                              </td>
                              {formData.type === HandoverType.RETURN && (
                                <td className="p-2 align-middle">
                                  {isCompleted && (
                                    <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded uppercase whitespace-nowrap">
                                      Đã xong
                                    </span>
                                  )}
                                  {isFailed && (
                                    <span className="text-[9px] font-black bg-red-100 text-red-800 border border-red-200 px-1.5 py-0.5 rounded uppercase whitespace-nowrap">
                                      Fail
                                    </span>
                                  )}
                                  {isUntested && (
                                    <span className="text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded uppercase whitespace-nowrap">
                                      Chưa thử
                                    </span>
                                  )}
                                </td>
                              )}
                            </tr>
                            {isSelected && (
                              <tr
                                className={`transition-colors ${isSelected ? "bg-blue-50/30" : ""}`}
                              >
                                <td className="border-t-0 p-0"></td>
                                <td
                                  colSpan={
                                    formData.type === HandoverType.RETURN ? 5 : 4
                                  }
                                  className="p-2 pt-0 pb-3 border-t-0"
                                >
                                  <input
                                    type="text"
                                    className={`w-full bg-white border rounded p-1.5 text-[10px] font-medium text-slate-700 outline-none focus:ring-1 ${
                                      formData.type === HandoverType.RETURN &&
                                      isUntested
                                        ? "border-amber-300 focus:ring-amber-500 bg-amber-50/10"
                                        : "border-blue-200 focus:ring-blue-500"
                                    }`}
                                    placeholder={
                                      formData.type === HandoverType.RETURN &&
                                      isUntested
                                        ? "Ghi rõ nguyên nhân trả mẫu chưa thử nghiệm (Bắt buộc)"
                                        : "Nhập ghi chú (Tình trạng, phụ kiện...)"
                                    }
                                    value={currentNote}
                                    onChange={(e) =>
                                      setLocalNotes({
                                        ...localNotes,
                                        [req.id]: e.target.value,
                                      })
                                    }
                                    disabled={isFormDisabled}
                                  />
                                  {formData.type === HandoverType.RETURN &&
                                    isUntested &&
                                    !String(currentNote).trim() && (
                                      <p className="text-[9px] text-red-500 font-bold mt-0.5">
                                        * Bắt buộc nhập nguyên nhân trả
                                      </p>
                                    )}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                      {filteredSamples.length === 0 && (
                        <tr>
                          <td
                            colSpan={formData.type === HandoverType.RETURN ? 6 : 5}
                            className="text-center py-10 text-slate-400 text-xs font-black italic"
                          >
                            {formData.type === HandoverType.RECEIVE
                              ? "Không có mẫu nào đang chờ nhận (Tất cả mẫu thuộc danh sách đã được nhận vào PTN)"
                              : "Không có mẫu nào trong PTN đang chờ trả"}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {formData.selectedSamples.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                      <span>Mẫu đã chọn ({formData.selectedSamples.length})</span>
                      {!isFormDisabled && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm("Bạn có chắc chắn muốn bỏ chọn tất cả các mẫu này?")) {
                              setFormData((prev) => ({
                                ...prev,
                                selectedSamples: [],
                              }));
                              setSelectedCustomerFilter("");
                            }
                          }}
                          className="text-[10px] font-bold text-red-500 hover:text-red-700 normal-case flex items-center gap-1 cursor-pointer"
                        >
                          Bỏ chọn tất cả
                        </button>
                      )}
                    </label>
                    <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl p-2 shadow-inner">
                      {formData.selectedSamples.map((sampleId) => {
                        const sample = availableRequests.find((r) => r.id === sampleId);
                        if (!sample) return null;
                        return (
                          <div key={sampleId} className="p-2 hover:bg-slate-50 transition-colors flex justify-between items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-black text-slate-800 flex items-center gap-1.5 truncate">
                                <span className="bg-blue-100 text-blue-800 text-[9px] px-1 rounded uppercase shrink-0">
                                  {sample.requestCode}
                                </span>
                                <span className="truncate">{sample.modelName}</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5 text-[9px] text-slate-500 mt-0.5 items-center">
                                <span className="truncate font-semibold text-indigo-600">{sample.customerName}</span>
                                {sample.type && (
                                  <>
                                    <span>•</span>
                                    <span className="truncate">{sample.type}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            {!isFormDisabled && (
                              <button
                                type="button"
                                onClick={() => {
                                  const nextSelected = formData.selectedSamples.filter((id) => id !== sampleId);
                                  setFormData((prev) => ({
                                    ...prev,
                                    selectedSamples: nextSelected,
                                  }));
                                  if (nextSelected.length === 0) {
                                    setSelectedCustomerFilter("");
                                  }
                                }}
                                className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors shrink-0 cursor-pointer"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {formData.type === HandoverType.RECEIVE && receiveMode === "NEW" && (
              <div className="space-y-3">
                <div
                  className={`border-2 border-dashed rounded-xl p-3 flex flex-col md:flex-row items-center justify-between gap-3 transition-all ${
                    isDragging
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300"
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragging(false);
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0)
                      handleProcessFiles(e.dataTransfer.files);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-white rounded-full shadow-sm border border-slate-100 flex items-center justify-center shrink-0">
                      {isScanning ? (
                        <Loader2 size={14} className="animate-spin text-blue-500" />
                      ) : (
                        <Sparkles size={14} className="text-blue-500" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black text-slate-700 leading-tight">
                        {isScanning ? "AI đang phân tích..." : "Nhận diện bằng AI"}
                      </h4>
                      <p className="text-[9px] text-slate-400">
                        Kéo thả ảnh, file hoặc dán (Ctrl+V) vào đây
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <label
                      className={`flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-[9px] font-black uppercase cursor-pointer hover:bg-emerald-100 shadow-xs transition-all ${
                        isScanning ? "opacity-50 pointer-events-none" : ""
                      }`}
                    >
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        capture="environment"
                        multiple
                        onChange={handleScanInput}
                      />
                      <Camera size={11} /> Chụp tem máy
                    </label>
                    <label
                      className={`flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg text-[9px] font-black uppercase cursor-pointer hover:bg-blue-100 shadow-xs transition-all ${
                        isScanning ? "opacity-50 pointer-events-none" : ""
                      }`}
                    >
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        multiple
                        onChange={handleScanInput}
                      />
                      <ImageIcon size={11} /> Tải file
                    </label>
                  </div>
                </div>

                {!existingDoc && (
                  <div className="space-y-3">
                    <div className="bg-orange-50 border border-orange-200 p-3 rounded-2xl space-y-2">
                      <div className="flex items-center gap-1.5 text-[10px] font-black text-orange-700 uppercase">
                        <Sparkles size={11} /> Phiếu yêu cầu & Số lô tự sinh
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[9px] font-black text-slate-500 uppercase mb-1 block">
                            Số phiếu yêu cầu *
                          </label>
                          <input
                            type="text"
                            className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-orange-500 uppercase"
                            value={manualRequestCode}
                            onChange={(e) => setManualRequestCode(e.target.value)}
                            placeholder="Số phiếu yêu cầu"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-slate-500 uppercase mb-1 block">
                            Số lô *
                          </label>
                          <input
                            type="text"
                            className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-orange-500 uppercase"
                            value={manualLot}
                            onChange={(e) => setManualLot(e.target.value)}
                            placeholder="Số lô tự sinh"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[9px] font-black text-slate-500 uppercase mb-1 block">
                            Sản phẩm
                          </label>
                          <SearchableSelect
                            options={products.map((p) => p.name)}
                            value={newItem.type}
                            onChange={(val) => setNewItem({ ...newItem, type: val })}
                            placeholder="Chọn sản phẩm..."
                            triggerClassName="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-700 outline-none cursor-pointer focus-within:ring-2 focus-within:ring-blue-500 flex items-center justify-between"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-slate-500 uppercase">
                            Tên Model / Thiết bị
                          </label>
                          <input
                            type="text"
                            className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                            value={newItem.modelName}
                            onChange={(e) =>
                              setNewItem({ ...newItem, modelName: e.target.value })
                            }
                            placeholder="VD: Inverter 10kW"
                          />
                        </div>
                        <div className="relative" ref={brandWrapperRef}>
                          <label className="text-[9px] font-black text-slate-500 uppercase">
                            Nhãn hiệu
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                              value={newItem.brand}
                              onChange={(e) => {
                                setNewItem({ ...newItem, brand: e.target.value });
                                setShowBrandSuggestions(true);
                              }}
                              onFocus={() => setShowBrandSuggestions(true)}
                              placeholder="Nhập hoặc chọn..."
                            />
                            {showBrandSuggestions && (
                              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-48 overflow-y-auto">
                                {brands
                                  .filter((b) =>
                                    b.toLowerCase().includes(newItem.brand.toLowerCase())
                                  )
                                  .map((b) => (
                                    <button
                                      key={b}
                                      type="button"
                                      className="w-full text-left p-2 hover:bg-blue-50 text-xs font-bold text-slate-700"
                                      onClick={() => {
                                        setNewItem({ ...newItem, brand: b });
                                        setShowBrandSuggestions(false);
                                      }}
                                    >
                                      {b}
                                    </button>
                                  ))}
                                {brands.filter((b) =>
                                  b.toLowerCase().includes(newItem.brand.toLowerCase())
                                ).length === 0 && (
                                  <div className="p-2 text-xs text-slate-400 italic text-center">
                                    Không tìm thấy nhãn hiệu phù hợp
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-slate-100 space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase block">
                          Hạng mục thử nghiệm
                        </label>
                        <div className="flex flex-wrap gap-4">
                          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                              checked={newItem.isAtd}
                              onChange={(e) => setNewItem({ ...newItem, isAtd: e.target.checked })}
                            />
                            An toàn điện (ATD)
                          </label>
                          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                              checked={newItem.isItd}
                              onChange={(e) => setNewItem({ ...newItem, isItd: e.target.checked })}
                            />
                            Hiệu suất năng lượng (ITD)
                          </label>
                          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                              checked={newItem.isEmc}
                              onChange={(e) => setNewItem({ ...newItem, isEmc: e.target.checked })}
                            />
                            Tương thích điện từ (EMC)
                          </label>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                        <div className="md:col-span-3">
                          <label className="text-[9px] font-black text-slate-500 uppercase">
                            Số lượng
                          </label>
                          <div className="flex bg-white border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 h-[36px]">
                            <button
                              type="button"
                              className="px-2 hover:bg-slate-50 border-r border-slate-200"
                              onClick={() =>
                                setNewItem({
                                  ...newItem,
                                  quantity: Math.max(1, newItem.quantity - 1),
                                })
                              }
                            >
                              -
                            </button>
                            <input
                              type="number"
                              className="w-full text-center text-xs font-bold text-slate-700 outline-none"
                              value={newItem.quantity}
                              onChange={(e) =>
                                setNewItem({
                                  ...newItem,
                                  quantity: Math.max(1, parseInt(e.target.value) || 1),
                                })
                              }
                            />
                            <button
                              type="button"
                              className="px-2 hover:bg-slate-50 border-l border-slate-200"
                              onClick={() =>
                                setNewItem({
                                  ...newItem,
                                  quantity: newItem.quantity + 1,
                                })
                              }
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <div className="md:col-span-3">
                          <label className="text-[9px] font-black text-slate-500 uppercase">
                            Đơn vị
                          </label>
                          <input
                            type="text"
                            list="units-list"
                            className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 h-[36px]"
                            value={newItem.unit}
                            onChange={(e) =>
                              setNewItem({ ...newItem, unit: e.target.value })
                            }
                            placeholder="Bộ, Cái..."
                          />
                          <datalist id="units-list">
                            {SAMPLE_UNITS.map((unit) => (
                              <option key={unit} value={unit} />
                            ))}
                          </datalist>
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-[9px] font-black text-slate-500 uppercase">
                            Ghi chú thiết bị
                          </label>
                          <input
                            type="text"
                            className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 h-[36px]"
                            value={newItem.note}
                            onChange={(e) =>
                              setNewItem({ ...newItem, note: e.target.value })
                            }
                            placeholder="Phụ kiện, tình trạng..."
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-[9px] font-black text-slate-500 uppercase">
                            Thông tin khác
                          </label>
                          <input
                            type="text"
                            className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 h-[36px]"
                            value={newItem.otherInfo}
                            onChange={(e) =>
                              setNewItem({ ...newItem, otherInfo: e.target.value })
                            }
                            placeholder="Nhập thông tin khác..."
                          />
                        </div>
                        <div className="md:col-span-2 flex items-end">
                          <button
                            type="button"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2 px-3 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 shadow-md shadow-blue-200 transition-all h-[36px]"
                            onClick={() => {
                              if (!newItem.modelName.trim()) {
                                toast.warning("Vui lòng nhập tên Model!");
                                return;
                              }
                              if (!newItem.isAtd && !newItem.isItd && !newItem.isEmc) {
                                toast.warning("Vui lòng chọn ít nhất một hạng mục thử nghiệm!");
                                return;
                              }
                              const lot = String(manualLot || "").trim() || "LOT";
                              const itemIndex = tempItems.length + 1;
                              const mtt = `M${String(itemIndex).padStart(2, "0")}`;

                              const atdEncode = newItem.isAtd ? `ITDC ${lot}-${mtt}` : "";
                              const itdEncode = newItem.isItd ? `ITD ${lot}-${mtt}` : "";
                              const emcEncode = newItem.isEmc ? `EMC ${lot}-${mtt}` : "";

                              let category = TestCategory.ATD;
                              if ((newItem.isAtd || newItem.isItd) && newItem.isEmc) {
                                category = TestCategory.BOTH;
                              } else if (newItem.isEmc) {
                                category = TestCategory.EMC;
                              }

                              const itemToAdd = {
                                id: `item-${Date.now()}`,
                                modelName: newItem.modelName,
                                brand: newItem.brand,
                                type: newItem.type,
                                testCategory: category,
                                quantity: newItem.quantity,
                                unit: newItem.unit || "Bộ",
                                note: newItem.note,
                                otherInfo: newItem.otherInfo,
                                atdEncodeNumber: atdEncode,
                                itdEncodeNumber: itdEncode,
                                emcEncodeNumber: emcEncode,
                              };
                              if (newItem.brand && newItem.brand.trim() !== "") {
                                useStore.getState().addBrand(newItem.brand.trim());
                              }
                              setTempItems([...tempItems, itemToAdd]);
                              setNewItem({
                                type: products.length > 0 ? products[0].name : "",
                                modelName: "",
                                brand: "",
                                quantity: 1,
                                unit: "Bộ",
                                note: "",
                                otherInfo: "",
                                isAtd: true,
                                isItd: false,
                                isEmc: false,
                              });
                            }}
                          >
                            <Plus size={14} /> Thêm
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Danh sách mẫu mới thêm ({tempItems.length})
                  </label>
                  <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl p-2">
                    {tempItems.map((item, idx) => (
                      <div key={item.id} className="p-2 hover:bg-slate-50 transition-colors flex justify-between items-start gap-2">
                        <div className="flex-1">
                          <div className="text-xs font-black text-slate-800">
                            {item.modelName}{" "}
                            <span className="font-semibold text-slate-400">
                              | {item.brand || "No Brand"}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 text-[10px] text-slate-500 mt-1">
                            <span>Sản phẩm: {item.type}</span>
                            <span>•</span>
                            <span>Số lượng: {item.quantity} {item.unit}</span>
                          </div>
                          {item.note && (
                            <div className="text-[10px] text-slate-500 italic mt-1 bg-slate-50 p-2 rounded border border-slate-100">
                              Ghi chú: {item.note}
                            </div>
                          )}
                          {item.otherInfo && (
                            <div className="text-[10px] text-slate-600 font-medium mt-1 bg-amber-50/50 p-1.5 rounded border border-amber-100">
                              <span className="font-bold text-amber-800">Thông tin khác:</span> {item.otherInfo}
                            </div>
                          )}
                        </div>
                        {!existingDoc && (
                          <button
                            type="button"
                            onClick={() =>
                              setTempItems(tempItems.filter((i) => i.id !== item.id))
                            }
                            className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                    {tempItems.length === 0 && (
                      <div className="text-center text-[10px] text-slate-400 italic py-4 border border-dashed rounded-xl">
                        Chưa có mẫu nào
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-slate-50 rounded-xl p-4 border border-dashed border-slate-300 text-center">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                Xác nhận ký tên
              </div>
              <div className="flex justify-between items-start text-xs font-bold text-slate-700">
                <div className="flex-1">
                  <div className="uppercase text-[10px] text-slate-400 mb-1">
                    {isReceive ? "Bên Giao (Đại diện/Lái xe)" : "Bên Giao (PTN)"}
                  </div>
                  <div className="px-2 min-h-[40px] flex flex-col justify-end">
                    {isReceive ? (
                      renderCustomerSignature()
                    ) : (
                      <div className="py-2 border-b border-slate-300">
                        {getSafeLabStaff().name}
                      </div>
                    )}
                  </div>
                </div>
                <div className="w-8"></div>
                <div className="flex-1">
                  <div className="uppercase text-[10px] text-slate-400 mb-1">
                    {isReceive ? "Bên Nhận (PTN)" : "Bên Nhận (Đại diện/Lái xe)"}
                  </div>
                  <div className="px-2 min-h-[40px] flex flex-col justify-end">
                    {!isReceive ? (
                      renderCustomerSignature()
                    ) : (
                      <div className="py-2 border-b border-slate-300">
                        {getSafeLabStaff().name}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-3 bg-slate-50 border-t border-slate-200 shrink-0 flex gap-3 pb-safe-offset">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 md:flex-none px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
        >
          Hủy bỏ
        </button>
        <div className="flex-1 md:flex-initial flex gap-2 justify-end">
          {existingDoc && isAdmin && !isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="flex-1 md:flex-none px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-amber-200 transition-all"
            >
              <Edit size={14} /> Chỉnh sửa
            </button>
          )}
          {(!existingDoc || isEditing) && (
            <button
              type="button"
              onClick={handleSaveOnly}
              className="flex-1 md:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-blue-200 transition-all"
            >
              <Save size={14} /> Lưu biên bản
            </button>
          )}
          <button
            type="button"
            onClick={handlePrintPreview}
            className="flex-1 md:flex-none px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-indigo-200 transition-all"
          >
            <Printer size={14} /> In Biên Bản
          </button>
          <button
            type="button"
            disabled={isExporting}
            onClick={handleExportOnly}
            className="flex-1 md:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-emerald-200 transition-all disabled:opacity-50"
          >
            {isExporting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <FileDown size={14} />
            )}
            Xuất file Word
          </button>
        </div>
      </div>
    </div>
  </div>
</div>
);
};

// --- End of components/HandoverModal.tsx ---
