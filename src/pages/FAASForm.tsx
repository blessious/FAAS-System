import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext.jsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Send, ArrowLeft, FileSpreadsheet, Loader2, X, ShieldCheck, User, MapPin, Calendar, FileText, ChevronRight, ChevronLeft, Eye, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { faasAPI } from "@/services/api";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Define interfaces for each row type
interface LandAppraisalRow {
  classification: string;
  sub_class: string;
  area: string;
  unit_value_land: string;
  market_value: string;
}

interface ImprovementRow {
  product_class: string;
  improvement_qty: string;
  unit_value_improvement: string;
  market_value_improvement: string;
}

interface MarketValueRow {
  market_value: string;
  adj_factor: string;
  percent_adjustment: string;
  value_adjustment: string;
  adjusted_market_value: string;
}

interface PropertyAssessmentRow {
  kind: string;
  actual_use: string;
  market_value_detail: string;
  assessment_level: string;
  assessed_value_detail: string;
}

interface FAASFormData {
  // Record Metadata
  encoder_name?: string;
  encoder_profile_picture?: string;

  // Basic Information
  arf_no: string;
  pin: string;
  oct_tct_no: string;
  cln: string;
  owner_name: string;
  owner_address: string;
  owner_barangay: string;
  owner_municipality: string;
  owner_province: string;
  administrator_name: string;
  administrator_address: string;
  owner_administrator: string;

  // Property Details
  property_location: string;
  property_barangay: string;
  property_municipality: string;
  property_province: string;
  north_boundary: string;
  south_boundary: string;
  east_boundary: string;
  west_boundary: string;

  // Arrays for multiple rows
  landAppraisals: LandAppraisalRow[];
  improvements: ImprovementRow[];
  marketValues: MarketValueRow[];
  propertyAssessments: PropertyAssessmentRow[];

  // Totals (calculated)
  land_appraisal_total: string;
  improvements_total: string;
  adjustment_total: string;
  assessment_total: string;

  // Aggregated values (for database)
  classification: string;
  sub_class: string;
  area: string;
  unit_value_land: string;
  market_value: string;
  product_class: string;
  improvement_qty: string;
  unit_value_improvement: string;
  market_value_improvement: string;
  adj_factor: string;
  percent_adjustment: string;
  value_adjustment: string;
  adjusted_market_value: string;
  kind: string;
  actual_use: string;
  market_value_detail: string;
  assessment_level: string;
  assessed_value: string;
  assessed_value_detail: string;

  // Previous Assessment
  effectivity_year: string;
  taxability: string;
  tax_rate: string;
  previous_td_no: string;
  previous_owner: string;
  previous_av_land: string;
  previous_av_improvements: string;
  memoranda: string;
  memoranda_code: string;
  memoranda_paragraph: string;
}

// Classification options for Land Appraisal
const landClassificationOptions = [
  "COMMERCIAL",
  "RESIDENTIAL",
  "COCAL",
  "IRRIGATED",
  "UNIRRIGATED",
  "UPLAND",
  "ORCHARD",
  "COGON LAND",
  "NIPA LAND",
  "FOREST LAND",
  "FISHPOND"
];

// Sub-class options based on classification
const getSubClassOptions = (classification: string) => {
  switch (classification) {
    case "COMMERCIAL":
      return ["C-1", "C-2", "C-3", "C-4"];
    case "RESIDENTIAL":
      return ["R-1", "R-2", "R-3", "R-4", "R-5", "R-6", "R-7"];
    case "COCAL":
      return ["1", "2", "3"];
    case "IRRIGATED":
    case "UNIRRIGATED":
      return ["1", "2", "3"];
    default:
      return [];
  }
};

// Product class options for Other Improvements
const productClassOptions = [
  "COCO BRG.-1",
  "COCO BRG.-2",
  "COCO BRG.-3",
  "AVOCADO",
  "BANANA",
  "CACAO",
  "CALAMANSI",
  "CAMANSI",
  "CHICO",
  "COFFEE",
  "JACKFRUIT",
  "LANZONES",
  "MABOLO",
  "MANGO",
  "ORANGE",
  "RAMBUTAN",
  "SANTOL",
  "SINEGUELAS",
  "STAR APPLE",
  "TAMARIND",
  "BAMBOO",
  "BURI",
  "NIPA"
];

// Kind options for Property Assessment
const kindOptions = ["LAND", "IMPROVEMENTS"];

// Actual Use options for Property Assessment
const actualUseOptions = ["AGRICULTURAL", "RESIDENTIAL", "COMMERCIAL"];

const initialRowData = {
  landAppraisals: Array(4).fill({
    classification: "",
    sub_class: "",
    area: "",
    unit_value_land: "",
    market_value: "",
  }),
  improvements: Array(4).fill({
    product_class: "",
    improvement_qty: "",
    unit_value_improvement: "",
    market_value_improvement: "",
  }),
  marketValues: Array(4).fill({
    market_value: "",
    adj_factor: "",
    percent_adjustment: "",
    value_adjustment: "",
    adjusted_market_value: "",
  }),
  propertyAssessments: Array(4).fill({
    kind: "",
    actual_use: "",
    market_value_detail: "",
    assessment_level: "",
    assessed_value_detail: "",
  }),
};

const initialFormData: FAASFormData = {
  arf_no: "",
  pin: "",
  oct_tct_no: "",
  cln: "",
  owner_name: "",
  owner_address: "",
  owner_barangay: "",
  owner_municipality: "",
  owner_province: "",
  administrator_name: "",
  administrator_address: "",
  owner_administrator: "",
  property_location: "",
  property_barangay: "",
  property_municipality: "BOAC",
  property_province: "MARINDUQUE",
  north_boundary: "",
  south_boundary: "",
  east_boundary: "",
  west_boundary: "",

  // Row arrays
  ...initialRowData,

  // Totals
  land_appraisal_total: "",
  improvements_total: "",
  adjustment_total: "",
  assessment_total: "",

  // Aggregated values
  classification: "",
  sub_class: "",
  area: "",
  unit_value_land: "",
  market_value: "",
  product_class: "",
  improvement_qty: "",
  unit_value_improvement: "",
  market_value_improvement: "",
  adj_factor: "",
  percent_adjustment: "",
  value_adjustment: "",
  adjusted_market_value: "",
  kind: "",
  actual_use: "",
  market_value_detail: "",
  assessment_level: "",
  assessed_value: "",
  assessed_value_detail: "",

  // Previous Assessment
  effectivity_year: "",
  taxability: "",
  tax_rate: "",
  previous_td_no: "",
  previous_owner: "",
  previous_av_land: "",
  previous_av_improvements: "",
  memoranda: "",
  memoranda_code: '',
  memoranda_paragraph: '',
};

const statusStyles = {
  draft: "bg-slate-100 text-slate-600 border-slate-200",
  for_approval: "bg-amber-50 text-amber-600 border-amber-100",
  approved: "bg-emerald-50 text-emerald-600 border-emerald-100",
  rejected: "bg-rose-50 text-rose-600 border-rose-100",
} as const;

export default function FAASForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { isEncoder } = useAuth() as { isEncoder?: boolean };
  const [formData, setFormData] = useState<FAASFormData>(initialFormData);
  const tabOrder = ["basic", "property", "appraisal", "assessment", "previous"] as const;
  type TabValue = (typeof tabOrder)[number];
  const [activeTab, setActiveTab] = useState<TabValue>("basic");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [recordStatus, setRecordStatus] = useState<string>('draft');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const showErrorToast = (error: any, defaultTitle: string = "Action Failed") => {
    console.error(`Error during ${defaultTitle}:`, error);

    // Extract the error message
    let message = "An unexpected error occurred. Please try again.";

    if (typeof error === 'string') {
      message = error;
    } else if (error?.error) {
      message = error.error;
    } else if (error?.message) {
      message = error.message;
    }

    // Append technical details if available (for "cmd error" visibility in frontend)
    const technicalDetails = error?.details?.sqlMessage || error?.sqlMessage;

    toast({
      title: defaultTitle,
      description: (
        <div className="space-y-1">
          <p>{message}</p>
          {technicalDetails && (
            <p className="text-[10px] font-mono opacity-70 border-t border-rose-300/30 pt-1 mt-1">
              Technical Log: {technicalDetails}
            </p>
          )}
        </div>
      ),
      variant: "destructive",
      className: "border-2 border-rose-200 shadow-lg",
    });
  };

  const handleDeleteRecord = async () => {
    if (!id) return;

    try {
      setDeleting(true);
      await faasAPI.deleteDraft(id);
      toast({
        title: "Record deleted",
        description: "The FAAS record has been deleted successfully.",
      });
      navigate("/dashboard");
    } catch (error: any) {
      showErrorToast(error, "Delete Failed");
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  // View/Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const isEditing = !!id;

  // Check if we're in view mode from navigation state
  useEffect(() => {
    if (location.state?.mode === 'view') {
      setIsEditMode(false);
    } else if (location.state?.mode === 'edit') {
      setIsEditMode(true);
    } else if (isEditing) {
      // Default to view mode for existing records
      setIsEditMode(false);
    } else {
      // New records are always in edit mode
      setIsEditMode(true);
    }
  }, [location.state, isEditing]);

  useEffect(() => {
    if (id) {
      fetchRecord();
    }
  }, [id]);

  const fetchRecord = async () => {
    try {
      setLoading(true);
      const response = await faasAPI.getRecord(id!);
      if (response.success && response.data) {
        // Parse JSON data if available, otherwise use single values
        let landAppraisals = initialRowData.landAppraisals;
        let improvements = initialRowData.improvements;
        let marketValues = initialRowData.marketValues;
        let propertyAssessments = initialRowData.propertyAssessments;

        if (response.data.land_appraisals_json) {
          try {
            // Handle if it's already an object (from some backends) or a string
            if (typeof response.data.land_appraisals_json === 'string') {
              // Check if it's a valid JSON string, not "[object Object]"
              if (response.data.land_appraisals_json.startsWith('[') || response.data.land_appraisals_json.startsWith('{')) {
                landAppraisals = JSON.parse(response.data.land_appraisals_json);
              } else {
                console.warn("Invalid JSON string for land_appraisals_json:", response.data.land_appraisals_json);
              }
            } else if (Array.isArray(response.data.land_appraisals_json)) {
              landAppraisals = response.data.land_appraisals_json;
            }

            while (landAppraisals.length < 4) {
              landAppraisals.push({
                classification: "",
                sub_class: "",
                area: "",
                unit_value_land: "",
                market_value: "",
              });
            }
          } catch (e) {
            console.error("Error parsing land_appraisals_json:", e);
            console.error("Data was:", response.data.land_appraisals_json);
          }
        } else {
          landAppraisals[0] = {
            classification: response.data.classification || "",
            sub_class: response.data.sub_class || "",
            area: response.data.area?.toString() || "",
            unit_value_land: response.data.unit_value_land?.toString() || "",
            market_value: response.data.market_value?.toString() || "",
          };
        }

        if (response.data.improvements_json) {
          try {
            if (typeof response.data.improvements_json === 'string') {
              if (response.data.improvements_json.startsWith('[') || response.data.improvements_json.startsWith('{')) {
                improvements = JSON.parse(response.data.improvements_json);
              } else {
                console.warn("Invalid JSON string for improvements_json:", response.data.improvements_json);
              }
            } else if (Array.isArray(response.data.improvements_json)) {
              improvements = response.data.improvements_json;
            }

            while (improvements.length < 4) {
              improvements.push({
                product_class: "",
                improvement_qty: "",
                unit_value_improvement: "",
                market_value_improvement: "",
              });
            }
          } catch (e) {
            console.error("Error parsing improvements_json:", e);
            console.error("Data was:", response.data.improvements_json);
          }
        } else {
          improvements[0] = {
            product_class: response.data.product_class || "",
            improvement_qty: response.data.improvement_qty?.toString() || "",
            unit_value_improvement: response.data.unit_value_improvement?.toString() || "",
            market_value_improvement: response.data.market_value_improvement?.toString() || "",
          };
        }

        if (response.data.assessments_json) {
          try {
            if (typeof response.data.assessments_json === 'string') {
              if (response.data.assessments_json.startsWith('[') || response.data.assessments_json.startsWith('{')) {
                propertyAssessments = JSON.parse(response.data.assessments_json);
              } else {
                console.warn("Invalid JSON string for assessments_json:", response.data.assessments_json);
              }
            } else if (Array.isArray(response.data.assessments_json)) {
              propertyAssessments = response.data.assessments_json;
            }

            while (propertyAssessments.length < 4) {
              propertyAssessments.push({
                kind: "",
                actual_use: "",
                market_value_detail: "",
                assessment_level: "",
                assessed_value_detail: "",
              });
            }
          } catch (e) {
            console.error("Error parsing assessments_json:", e);
            console.error("Data was:", response.data.assessments_json);
          }
        } else {
          propertyAssessments[0] = {
            kind: response.data.kind || "",
            actual_use: response.data.actual_use || "",
            market_value_detail: response.data.market_value_detail?.toString() || "",
            assessment_level: response.data.assessment_level?.toString() || "",
            assessed_value_detail: response.data.assessed_value_detail?.toString() || "",
          };
        }

        if (response.data.market_values_json) {
          try {
            if (typeof response.data.market_values_json === 'string') {
              if (response.data.market_values_json.startsWith('[') || response.data.market_values_json.startsWith('{')) {
                marketValues = JSON.parse(response.data.market_values_json);
              } else {
                console.warn("Invalid JSON string for market_values_json:", response.data.market_values_json);
              }
            } else if (Array.isArray(response.data.market_values_json)) {
              marketValues = response.data.market_values_json;
            }

            while (marketValues.length < 4) {
              marketValues.push({
                market_value: "",
                adj_factor: "",
                percent_adjustment: "",
                value_adjustment: "",
                adjusted_market_value: "",
              });
            }
          } catch (e) {
            console.error("Error parsing market_values_json:", e);
            console.error("Data was:", response.data.market_values_json);
          }
        }

        const fetchedData = {
          ...initialFormData,
          arf_no: response.data.arf_no?.toString() || "",
          pin: response.data.pin?.toString() || "",
          oct_tct_no: response.data.oct_tct_no?.toString() || "",
          cln: response.data.cln?.toString() || "",
          owner_name: response.data.owner_name?.toString() || "",
          owner_address: response.data.owner_address?.toString() || "",
          owner_barangay: response.data.owner_barangay?.toString() || "",
          owner_municipality: response.data.owner_municipality?.toString() || "",
          owner_province: response.data.owner_province?.toString() || "",
          administrator_name: response.data.administrator_name?.toString() || "",
          administrator_address: response.data.administrator_address?.toString() || "",
          owner_administrator: response.data.owner_administrator?.toString() || "",
          property_location: response.data.property_location?.toString() || "",
          property_barangay: response.data.property_barangay?.toString() || "",
          property_municipality: "BOAC",
          property_province: "MARINDUQUE",
          north_boundary: response.data.north_boundary?.toString() || "",
          south_boundary: response.data.south_boundary?.toString() || "",
          east_boundary: response.data.east_boundary?.toString() || "",
          west_boundary: response.data.west_boundary?.toString() || "",

          landAppraisals,
          improvements,
          marketValues,
          propertyAssessments,

          land_appraisal_total: response.data.land_appraisal_total?.toString() || "",
          improvements_total: response.data.improvements_total?.toString() || "",
          adjustment_total: response.data.adjustment_total?.toString() || "",
          assessment_total: response.data.assessment_total?.toString() || "",
          assessed_value: response.data.assessed_value?.toString() || "",
          effectivity_year: response.data.effectivity_year?.toString() || "",
          taxability: response.data.taxability || "",
          tax_rate: response.data.tax_rate?.toString() || "",
          previous_td_no: response.data.previous_td_no || "",
          previous_owner: response.data.previous_owner || "",
          previous_av_land: response.data.previous_av_land?.toString() || "",
          previous_av_improvements: response.data.previous_av_improvements?.toString() || "",
          memoranda: response.data.memoranda || "",
          memoranda_code: response.data.memoranda_code || "",
          memoranda_paragraph: response.data.memoranda_paragraph || "",
        };

        setFormData(fetchedData);
        setRecordStatus(response.data.status || 'draft');
      }
    } catch (error: any) {
      showErrorToast(error, "Load Failed");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleRowInputChange = (
    section: 'landAppraisals' | 'improvements' | 'marketValues' | 'propertyAssessments',
    index: number,
    field: string,
    value: string
  ) => {
    if (!isEditable) return;

    setFormData(prev => {
      const updatedRows = [...prev[section]];
      updatedRows[index] = { ...updatedRows[index], [field]: value };

      if (section === 'landAppraisals' && field === 'classification') {
        (updatedRows[index] as LandAppraisalRow).sub_class = "";
      }

      return { ...prev, [section]: updatedRows };
    });
  };

  const handleInputChange = (field: keyof FAASFormData, value: string) => {
    if (!isEditable) return;
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveDraft = async () => {
    if (!isEditable) return;

    try {
      setSaving(true);

      const requiredFields = [
        { field: 'pin', label: 'PIN' },
        { field: 'oct_tct_no', label: 'OCT/TCT No.' },
        { field: 'owner_name', label: 'Owner Name' },
        { field: 'owner_address', label: 'Owner Address' },
        { field: 'property_barangay', label: 'Property Barangay' }
      ];

      const missingFields = requiredFields.filter(f => !formData[f.field as keyof FAASFormData]?.toString().trim());

      if (missingFields.length > 0) {
        toast({
          title: "Required Fields Missing",
          description: `Please fill in: ${missingFields.map(f => f.label).join(', ')}`,
          variant: "destructive",
        });
        setSaving(false);
        return;
      }

      const requestData = {
        arf_no: formData.arf_no || null,
        pin: formData.pin || null,
        oct_tct_no: formData.oct_tct_no || null,
        cln: formData.cln || null,
        owner_name: formData.owner_name,
        owner_address: formData.owner_address || null,
        owner_barangay: formData.owner_barangay || null,
        owner_municipality: formData.owner_municipality || null,
        owner_province: formData.owner_province || null,
        administrator_name: formData.administrator_name || null,
        administrator_address: formData.administrator_address || null,
        owner_administrator: formData.owner_administrator || null,
        property_location: formData.property_location || null,
        property_barangay: formData.property_barangay || null,
        property_municipality: formData.property_municipality || null,
        property_province: formData.property_province || null,
        north_boundary: formData.north_boundary || null,
        south_boundary: formData.south_boundary || null,
        east_boundary: formData.east_boundary || null,
        west_boundary: formData.west_boundary || null,

        classification: formData.landAppraisals[0]?.classification || null,
        sub_class: formData.landAppraisals[0]?.sub_class || null,
        area: formData.landAppraisals[0]?.area.trim() !== ''
          ? parseFloat(formData.landAppraisals[0].area)
          : null,
        unit_value_land: formData.landAppraisals[0]?.unit_value_land.trim() !== ''
          ? parseFloat(formData.landAppraisals[0].unit_value_land)
          : null,
        market_value: formData.landAppraisals[0]?.market_value.trim() !== ''
          ? parseFloat(formData.landAppraisals[0].market_value)
          : null,

        product_class: formData.improvements[0]?.product_class || null,
        improvement_qty: formData.improvements[0]?.improvement_qty.trim() !== ''
          ? parseInt(formData.improvements[0].improvement_qty)
          : null,
        unit_value_improvement: formData.improvements[0]?.unit_value_improvement.trim() !== ''
          ? parseFloat(formData.improvements[0].unit_value_improvement)
          : null,
        market_value_improvement: formData.improvements[0]?.market_value_improvement.trim() !== ''
          ? parseFloat(formData.improvements[0].market_value_improvement)
          : null,

        land_appraisals_json: JSON.stringify(formData.landAppraisals),
        improvements_json: JSON.stringify(formData.improvements),
        market_values_json: JSON.stringify(formData.marketValues),
        assessments_json: JSON.stringify(formData.propertyAssessments),

        assessed_value: formData.assessed_value.trim() !== ''
          ? parseFloat(formData.assessed_value)
          : null,

        effectivity_year: (formData.effectivity_year?.toString() || "").trim() !== ''
          ? formData.effectivity_year.toString()
          : null,
        taxability: formData.taxability || null,
        tax_rate: formData.tax_rate.trim() !== ''
          ? parseFloat(formData.tax_rate)
          : null,

        land_appraisal_total: formData.land_appraisal_total.trim() !== ''
          ? parseFloat(formData.land_appraisal_total)
          : null,
        improvements_total: formData.improvements_total.trim() !== ''
          ? parseFloat(formData.improvements_total)
          : null,
        adjustment_total: formData.adjustment_total.trim() !== ''
          ? parseFloat(formData.adjustment_total)
          : null,
        assessment_total: formData.assessment_total.trim() !== ''
          ? parseFloat(formData.assessment_total)
          : null,

        previous_td_no: formData.previous_td_no || null,
        previous_owner: formData.previous_owner || null,
        previous_av_land: formData.previous_av_land.trim() !== ''
          ? parseFloat(formData.previous_av_land)
          : null,
        previous_av_improvements: formData.previous_av_improvements.trim() !== ''
          ? parseFloat(formData.previous_av_improvements)
          : null,

        memoranda: formData.memoranda || null,
        memoranda_code: formData.memoranda_code || null,
        memoranda_paragraph: formData.memoranda_paragraph || null,
      };

      let response;

      if (isEditing) {
        if (recordStatus === 'draft') {
          response = await faasAPI.saveAsDraft(id!, requestData);
        } else if (recordStatus === 'for_approval' || (recordStatus === 'rejected' && isEncoder)) {
          response = await faasAPI.updateRecord(id!, requestData);
        } else {
          toast({
            title: "Cannot Save",
            description: "This record cannot be saved in its current status.",
            variant: "destructive",
          });
          setSaving(false);
          return;
        }
      } else {
        response = await faasAPI.createDraft(requestData);
      }

      if (response.success) {
        const becameDraft = response.status === "draft" && recordStatus === "for_approval";
        if (becameDraft) {
          setRecordStatus("draft");
          toast({
            title: "Saved as Draft",
            description: "Record withdrawn from pending and saved as draft.",
          });
        } else {
          toast({
            title: recordStatus === "draft" ? "Draft Saved" : "Record Saved",
            description: recordStatus === "draft"
              ? "Your FAAS record has been saved as a draft."
              : "Your changes have been saved.",
          });
        }
        if (!isEditing && response.data?.id) {
          navigate(`/faas/${response.data.id}`, { state: { mode: 'view' } });
        }
      }

    } catch (error: any) {
      showErrorToast(error, "Save Failed");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!isEditable) return;

    try {
      setSubmitting(true);

      const requiredFields = [
        { field: 'pin', label: 'PIN' },
        { field: 'oct_tct_no', label: 'OCT/TCT No.' },
        { field: 'owner_name', label: 'Owner Name' },
        { field: 'owner_address', label: 'Owner Address' },
        { field: 'property_barangay', label: 'Property Barangay' }
      ];

      const missingFields = requiredFields.filter(f => !formData[f.field as keyof FAASFormData]?.toString().trim());

      if (missingFields.length > 0) {
        toast({
          title: "Submission Blocked",
          description: `The following required fields are missing: ${missingFields.map(f => f.label).join(', ')}`,
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      const requestData = {
        arf_no: formData.arf_no || null,
        pin: formData.pin || null,
        oct_tct_no: formData.oct_tct_no || null,
        cln: formData.cln || null,
        owner_name: formData.owner_name,
        owner_address: formData.owner_address || null,
        owner_barangay: formData.owner_barangay || null,
        owner_municipality: formData.owner_municipality || null,
        owner_province: formData.owner_province || null,
        administrator_name: formData.administrator_name || null,
        administrator_address: formData.administrator_address || null,
        owner_administrator: formData.owner_administrator || null,
        property_location: formData.property_location || null,
        property_barangay: formData.property_barangay || null,
        property_municipality: formData.property_municipality || null,
        property_province: formData.property_province || null,
        north_boundary: formData.north_boundary || null,
        south_boundary: formData.south_boundary || null,
        east_boundary: formData.east_boundary || null,
        west_boundary: formData.west_boundary || null,

        classification: formData.landAppraisals[0]?.classification || null,
        sub_class: formData.landAppraisals[0]?.sub_class || null,
        area: formData.landAppraisals[0]?.area.trim() !== ''
          ? parseFloat(formData.landAppraisals[0].area)
          : null,
        unit_value_land: formData.landAppraisals[0]?.unit_value_land.trim() !== ''
          ? parseFloat(formData.landAppraisals[0].unit_value_land)
          : null,
        market_value: formData.landAppraisals[0]?.market_value.trim() !== ''
          ? parseFloat(formData.landAppraisals[0].market_value)
          : null,

        product_class: formData.improvements[0]?.product_class || null,
        improvement_qty: formData.improvements[0]?.improvement_qty.trim() !== ''
          ? parseInt(formData.improvements[0].improvement_qty)
          : null,
        unit_value_improvement: formData.improvements[0]?.unit_value_improvement.trim() !== ''
          ? parseFloat(formData.improvements[0].unit_value_improvement)
          : null,
        market_value_improvement: formData.improvements[0]?.market_value_improvement.trim() !== ''
          ? parseFloat(formData.improvements[0].market_value_improvement)
          : null,

        land_appraisals_json: JSON.stringify(formData.landAppraisals),
        improvements_json: JSON.stringify(formData.improvements),
        market_values_json: JSON.stringify(formData.marketValues),
        assessments_json: JSON.stringify(formData.propertyAssessments),

        assessed_value: formData.assessed_value.trim() !== ''
          ? parseFloat(formData.assessed_value)
          : null,

        effectivity_year: (formData.effectivity_year?.toString() || "").trim() !== ''
          ? formData.effectivity_year.toString()
          : null,
        taxability: formData.taxability || null,
        tax_rate: formData.tax_rate.trim() !== ''
          ? parseFloat(formData.tax_rate)
          : null,

        land_appraisal_total: formData.land_appraisal_total.trim() !== ''
          ? parseFloat(formData.land_appraisal_total)
          : null,
        improvements_total: formData.improvements_total.trim() !== ''
          ? parseFloat(formData.improvements_total)
          : null,
        adjustment_total: formData.adjustment_total.trim() !== ''
          ? parseFloat(formData.adjustment_total)
          : null,
        assessment_total: formData.assessment_total.trim() !== ''
          ? parseFloat(formData.assessment_total)
          : null,

        previous_td_no: formData.previous_td_no || null,
        previous_owner: formData.previous_owner || null,
        previous_av_land: formData.previous_av_land.trim() !== ''
          ? parseFloat(formData.previous_av_land)
          : null,
        previous_av_improvements: formData.previous_av_improvements.trim() !== ''
          ? parseFloat(formData.previous_av_improvements)
          : null,

        memoranda: formData.memoranda || null,
        memoranda_code: formData.memoranda_code || null,
        memoranda_paragraph: formData.memoranda_paragraph || null,
      };

      if (!id) {
        toast({
          title: "Creating Record",
          description: "Creating FAAS record and generating Excel file...",
        });

        const createResponse = await faasAPI.createRecord(requestData);

        if (createResponse.success && createResponse.data?.id) {
          toast({
            title: "Submitting for Approval",
            description: "Your FAAS record is being submitted and Excel is being generated...",
          });

          const submitResponse = await faasAPI.submitForApproval(createResponse.data.id);

          if (submitResponse.success) {
            if (submitResponse.excelGenerated) {
              toast({
                title: "✅ Submitted Successfully",
                description: "FAAS record submitted for approval and Excel file generated.",
              });
            } else {
              toast({
                title: "⚠️ Submitted with Warning",
                description: "Record submitted but Excel generation may have failed.",
                variant: "destructive",
              });
            }
            navigate("/dashboard");
          }
        }
      } else if (recordStatus === 'draft' || recordStatus === 'for_approval' || (recordStatus === 'rejected' && isEncoder)) {
        toast({
          title: "Submitting for Approval",
          description: "Your FAAS record is being submitted and Excel is being generated...",
        });

        const updateResponse = await faasAPI.updateRecord(id, requestData);

        if (updateResponse.success) {
          const submitResponse = await faasAPI.submitForApproval(id);

          if (submitResponse.success) {
            if (submitResponse.excelGenerated) {
              toast({
                title: "✅ Submitted Successfully",
                description: "FAAS record submitted for approval and Excel file generated.",
              });
            } else {
              toast({
                title: "⚠️ Submitted with Warning",
                description: "Record submitted but Excel generation may have failed.",
                variant: "destructive",
              });
            }
            navigate("/dashboard");
          }
        }
      } else {
        toast({
          title: "Cannot Submit",
          description: "This record cannot be submitted. Please check the status.",
          variant: "destructive",
        });
        setSubmitting(false);
      }

    } catch (error: any) {
      showErrorToast(error, "Submission Failed");
      setSubmitting(false);
    }
  };

  const handleGenerateExcel = () => {
    toast({
      title: "Excel Generated",
      description: "The FAAS Excel file has been generated successfully.",
    });
  };

  const getStatusBadge = () => {
    return (
      <Badge
        variant="outline"
        className={cn(
          "px-2.5 py-0.5 rounded-full text-[11px] font-bold border shadow-none",
          statusStyles[recordStatus as keyof typeof statusStyles] || statusStyles.draft
        )}
      >
        {recordStatus === 'draft' ? 'Draft' :
          recordStatus === 'for_approval' ? 'Pending Approval' :
            recordStatus === 'approved' ? 'Approved' :
              recordStatus === 'rejected' ? 'Rejected' : recordStatus}
      </Badge>
    );
  };

  // Update isEditable to consider edit mode
  const isEditable = (isEditMode || !isEditing) &&
    (recordStatus === 'draft' || recordStatus === 'for_approval' || (!!isEncoder && recordStatus === 'rejected'));

  const currentTabIndex = Math.max(0, tabOrder.indexOf(activeTab));
  const isFirstTab = currentTabIndex === 0;
  const isLastTab = currentTabIndex === tabOrder.length - 1;

  const goToNextTab = () => {
    setActiveTab(tabOrder[Math.min(currentTabIndex + 1, tabOrder.length - 1)]);
  };

  const goToPreviousTab = () => {
    setActiveTab(tabOrder[Math.max(currentTabIndex - 1, 0)]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-50 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
          <p className="text-lg font-semibold text-slate-700">Loading FAAS record...</p>
          <p className="text-sm text-slate-400 mt-2">Please wait a moment</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header - Compact */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-100 px-4 lg:px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 h-9 w-9"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shadow-sm",
                isEditMode ? "bg-blue-600" : "bg-slate-600"
              )}>
                {isEditMode ? (
                  <FileText className="w-4 h-4 text-white" />
                ) : (
                  <Eye className="w-4 h-4 text-white" />
                )}
              </div>
              <div>
                <h1 className="text-sx font-bold text-slate-900">
                  {!isEditing ? "New FAAS Record" :
                    isEditMode ? "Edit FAAS Record" : "View FAAS Record"}
                </h1>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-slate-500">
                    Real Property Field Appraisal and Assessment Sheet
                  </p>
                  {getStatusBadge()}
                  {isEditing && !isEditMode && (
                    <Badge variant="outline" className="ml-1 px-2 py-0.5 bg-slate-100 text-slate-700 border-slate-200 text-[10px]">
                      View Only
                    </Badge>
                  )}
                  {formData.encoder_name && (
                    <div className="hidden md:flex items-center gap-1.5 ml-2 pl-2 border-l border-slate-200">
                      <Avatar className="w-5 h-5 border border-slate-200">
                        {formData.encoder_profile_picture ? (
                          <AvatarImage
                            src={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}${formData.encoder_profile_picture}`}
                            className="object-cover"
                          />
                        ) : null}
                        <AvatarFallback className="bg-slate-100 text-[8px] font-bold text-slate-600">
                          {formData.encoder_name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-[10px] font-medium text-slate-500">
                        Encoded by <span className="text-slate-700">{formData.encoder_name}</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {recordStatus === 'approved' && (
              <Button
                variant="outline"
                onClick={handleGenerateExcel}
                size="sm"
                className="gap-1 rounded-lg border-slate-200 text-slate-600 hover:bg-slate-50 h-9 px-3"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Generate Excel</span>
              </Button>
            )}

            {/* View mode actions */}
            {isEditing && !isEditMode && isEditable && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteDialog(true)}
                  size="sm"
                  className="gap-1 rounded-lg border-rose-200 text-rose-600 hover:bg-rose-50 h-9 px-3"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Delete</span>
                </Button>
                <Button
                  variant="default"
                  onClick={() => setIsEditMode(true)}
                  size="sm"
                  className="gap-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white h-9 px-3"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Edit Record</span>
                </Button>
              </div>
            )}

            {/* Edit mode actions */}
            {isEditable && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (isEditing) {
                      setIsEditMode(false);
                    } else {
                      navigate(-1);
                    }
                  }}
                  size="sm"
                  className="gap-1 rounded-lg border-slate-200 text-slate-600 hover:bg-slate-50 h-9 px-3"
                >
                  <X className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{isEditing ? "Cancel" : "Cancel"}</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSaveDraft}
                  size="sm"
                  className="gap-1 rounded-lg border-blue-200 text-blue-600 hover:bg-blue-50 h-9 px-3"
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">{saving ? "Saving..." : "Save Draft"}</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="rounded-2xl border-2 border-rose-100 bg-white shadow-xl">
          <AlertDialogHeader>
            <div className="p-3 bg-gradient-to-r from-rose-50 to-pink-50 rounded-xl inline-flex w-12 h-12 items-center justify-center mb-4">
              <Trash2 className="w-6 h-6 text-rose-600" />
            </div>
            <AlertDialogTitle className="text-xl font-bold text-slate-900">Delete record?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500">
              This FAAS record will be permanently deleted from the system. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel className="rounded-xl border-2 border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRecord}
              disabled={deleting}
              className="rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-700 hover:to-rose-600 text-white shadow-lg shadow-rose-500/30"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Record"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="p-4 lg:p-6">
        {/* Form Header with Municipality Info - Compact */}
        <Card className="border-slate-100 shadow-sm overflow-hidden mb-4">
          <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-blue-50 to-white px-4 py-3">
            <div className="flex items-center justify-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                <img
                  src="/templates/boaclogo.png"
                  alt="Boac Logo"
                  className="w-8 h-8 object-contain"
                />
              </div>
              <div className="flex-shrink-0 text-center">
                <h2 className="font-bold text-base text-slate-900">MUNICIPALITY OF BOAC</h2>
                <p className="text-xs font-semibold text-slate-600">OFFICE OF THE MUNICIPAL ASSESSOR</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                <img
                  src="/templates/bagongpilipinas.png"
                  alt="Bagong Pilipinas"
                  className="w-8 h-8 object-contain"
                />
              </div>
            </div>
            <CardTitle className="text-center mt-3 text-sm font-bold text-slate-900">
              REAL PROPERTY FIELD APPRAISAL AND ASSESSMENT SHEET - LAND PLANTS & TREES
            </CardTitle>
          </CardHeader>

          <CardContent className="p-4">
            <Tabs
              value={activeTab}
              onValueChange={(value) => {
                if (tabOrder.includes(value as TabValue)) {
                  setActiveTab(value as TabValue);
                } else {
                  setActiveTab("basic");
                }
              }}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-5 bg-slate-200 p-1 rounded-xl text-xs h-auto">
                <TabsTrigger
                  value="basic"
                  className="w-full rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md text-slate-600 font-semibold py-2.5 px-1 transition-all duration-200 hover:bg-slate-300 hover:text-slate-800"
                >
                  Basic Info
                </TabsTrigger>
                <TabsTrigger
                  value="property"
                  className="w-full rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md text-slate-600 font-semibold py-2.5 px-1 transition-all duration-200 hover:bg-slate-300 hover:text-slate-800"
                >
                  Property Boundaries
                </TabsTrigger>
                <TabsTrigger
                  value="appraisal"
                  className="w-full rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md text-slate-600 font-semibold py-2.5 px-1 transition-all duration-200 hover:bg-slate-300 hover:text-slate-800"
                >
                  Land Appraisal
                </TabsTrigger>
                <TabsTrigger
                  value="assessment"
                  className="w-full rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md text-slate-600 font-semibold py-2.5 px-1 transition-all duration-200 hover:bg-slate-300 hover:text-slate-800"
                >
                  Assessment
                </TabsTrigger>
                <TabsTrigger
                  value="previous"
                  className="w-full rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-md text-slate-600 font-semibold py-2.5 px-1 transition-all duration-200 hover:bg-slate-300 hover:text-slate-800"
                >
                  Previous
                </TabsTrigger>
              </TabsList>

              {/* Basic Information Tab - Compact */}
              <TabsContent value="basic" className="mt-4">
                <div className="bg-white rounded-lg border border-slate-100 p-4">
                  <div className="mb-4">
                    <h3 className="text-base font-bold text-slate-900 mb-1">Basic Information</h3>
                    <p className="text-xs text-slate-500">Enter essential details of property and owner</p>
                  </div>

                  <div className="space-y-4">
                    {/* Row 1: ARF No, PIN, OCT/TCT No, Survey No */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="flex flex-col">
                        <Label htmlFor="arf_no" className="text-sm font-semibold text-slate-700 mb-1.5 h-5">
                          ARF No.
                        </Label>
                        <Input
                          id="arf_no"
                          value={formData.arf_no}
                          onChange={(e) => handleInputChange("arf_no", e.target.value)}
                          placeholder="e.g., 2024-001"
                          className="border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 h-9 rounded-lg bg-white text-sm"
                          disabled={!isEditable}
                        />
                      </div>
                      <div className="flex flex-col">
                        <Label htmlFor="pin" className="text-sm font-semibold text-slate-700 flex items-center gap-0.5 mb-1.5 h-5">
                          PIN <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="pin"
                          value={formData.pin}
                          onChange={(e) => handleInputChange("pin", e.target.value)}
                          placeholder="Enter PIN"
                          className="border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 h-9 rounded-lg bg-white text-sm"
                          disabled={!isEditable}
                        />
                      </div>
                      <div className="flex flex-col">
                        <Label htmlFor="oct_tct_no" className="text-sm font-semibold text-slate-700 flex items-center gap-0.5 mb-1.5 h-5">
                          OCT/TCT No. <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="oct_tct_no"
                          value={formData.oct_tct_no}
                          onChange={(e) => handleInputChange("oct_tct_no", e.target.value)}
                          placeholder="Enter OCT/TCT No."
                          className="border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 h-9 rounded-lg bg-white text-sm"
                          disabled={!isEditable}
                        />
                      </div>
                      <div className="flex flex-col">
                        <Label htmlFor="cln" className="text-sm font-semibold text-slate-700 mb-1.5 h-5">Survey No.</Label>
                        <Input
                          id="cln"
                          value={formData.cln}
                          onChange={(e) => handleInputChange("cln", e.target.value)}
                          placeholder="Optional"
                          className="border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 h-9 rounded-lg bg-white text-sm"
                          disabled={!isEditable}
                        />
                      </div>
                    </div>

                    {/* Row 2: Owner and Address */}
                    <div className="space-y-1.5">
                      <Label htmlFor="owner_name" className="text-sm font-semibold text-slate-700 flex items-center gap-0.5">
                        Owner <span className="text-red-500">*</span>
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="owner_name"
                          value={formData.owner_name}
                          onChange={(e) => handleInputChange("owner_name", e.target.value)}
                          placeholder="Full name of property owner"
                          className="border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 h-9 rounded-lg bg-white text-sm flex-1"
                          disabled={!isEditable}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="owner_address" className="text-sm font-semibold text-slate-700 flex items-center gap-0.5 mb-1.5 h-5">
                        Owner's Address <span className="text-red-500">*</span>
                      </Label>
                      <Textarea
                        id="owner_address"
                        value={formData.owner_address}
                        onChange={(e) => handleInputChange("owner_address", e.target.value)}
                        placeholder="Complete address of the property owner"
                        className="border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 min-h-[70px] rounded-lg bg-white text-sm"
                        disabled={!isEditable}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="owner_administrator" className="text-sm font-semibold text-slate-700">
                        Owner/Administrator <span className="text-red-500 text-[10px] italic font-normal ml-1">(Appears in A51 Signature Line)</span>
                      </Label>
                      <Input
                        id="owner_administrator"
                        value={formData.owner_administrator}
                        onChange={(e) => handleInputChange("owner_administrator", e.target.value)}
                        placeholder="Name of Owner or Administrator for signature"
                        className="border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 h-9 rounded-lg bg-white text-sm"
                        disabled={!isEditable}
                      />
                    </div>
                  </div>
                </div>
                {/* Administrator Information Section */}
                <div className="space-y-4 mt-4 pt-4 border-t border-slate-200">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <h4 className="text-sx font-semibold text-slate-900">Administrator Information</h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="administrator_name" className="text-sm font-semibold text-slate-700">
                        Administrator Name
                      </Label>
                      <Input
                        id="administrator_name"
                        value={formData.administrator_name}
                        onChange={(e) => handleInputChange("administrator_name", e.target.value)}
                        placeholder="Name of administrator (if any)"
                        className="border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 h-9 rounded-lg bg-white text-sm"
                        disabled={!isEditable}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="administrator_address" className="text-sm font-semibold text-slate-700">
                        Administrator Address
                      </Label>
                      <Input
                        id="administrator_address"
                        value={formData.administrator_address}
                        onChange={(e) => handleInputChange("administrator_address", e.target.value)}
                        placeholder="Address of administrator"
                        className="border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 h-9 rounded-lg bg-white text-sm"
                        disabled={!isEditable}
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Property Details Tab - Compact */}
              <TabsContent value="property" className="mt-4">
                <div className="bg-white rounded-lg border border-slate-100 p-4">
                  <div className="mb-4">
                    <h3 className="text-base font-bold text-slate-900 mb-1">Property Details</h3>
                    <p className="text-xs text-slate-500">Enter location and boundaries of the property</p>
                  </div>

                  <div className="space-y-6">
                    {/* Property Location Section */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center">
                          <MapPin className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <h4 className="text-sm font-semibold text-slate-900">Property Location</h4>
                      </div>

                      <div className="grid gap-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label htmlFor="property_location" className="text-sm font-semibold text-slate-700">
                              No. Street / Location
                            </Label>
                            <Input
                              id="property_location"
                              value={formData.property_location}
                              onChange={(e) => handleInputChange("property_location", e.target.value)}
                              placeholder="Street/Barangay"
                              className="border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 h-9 rounded-lg bg-white text-sm"
                              disabled={!isEditable}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="property_barangay" className="text-sm font-semibold text-slate-700 flex items-center gap-0.5">
                              Barangay <span className="text-red-500">*</span>
                            </Label>
                            <Input
                              id="property_barangay"
                              value={formData.property_barangay}
                              onChange={(e) => handleInputChange("property_barangay", e.target.value)}
                              placeholder="Barangay name"
                              className="border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 h-9 rounded-lg bg-white text-sm"
                              disabled={!isEditable}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label htmlFor="property_municipality" className="text-sm font-semibold text-slate-700">Municipality</Label>
                            <Input
                              id="property_municipality"
                              value="BOAC"
                              className="border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 h-9 rounded-lg bg-slate-50 text-slate-600 text-sm"
                              disabled
                              readOnly
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="property_province" className="text-sm font-semibold text-slate-700">Province/City</Label>
                            <Input
                              id="property_province"
                              value="MARINDUQUE"
                              className="border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 h-9 rounded-lg bg-slate-50 text-slate-600 text-sm"
                              disabled
                              readOnly
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Property Boundaries Section */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center">
                          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <h4 className="text-sm font-semibold text-slate-900">Property Boundaries</h4>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="north_boundary" className="text-sm font-semibold text-slate-700">North</Label>
                          <Input
                            id="north_boundary"
                            value={formData.north_boundary}
                            onChange={(e) => handleInputChange("north_boundary", e.target.value)}
                            placeholder="North boundary"
                            className="border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 h-9 rounded-lg bg-white text-sm"
                            disabled={!isEditable}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="south_boundary" className="text-sm font-semibold text-slate-700">South</Label>
                          <Input
                            id="south_boundary"
                            value={formData.south_boundary}
                            onChange={(e) => handleInputChange("south_boundary", e.target.value)}
                            placeholder="South boundary"
                            className="border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 h-9 rounded-lg bg-white text-sm"
                            disabled={!isEditable}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="east_boundary" className="text-sm font-semibold text-slate-700">East</Label>
                          <Input
                            id="east_boundary"
                            value={formData.east_boundary}
                            onChange={(e) => handleInputChange("east_boundary", e.target.value)}
                            placeholder="East boundary"
                            className="border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 h-9 rounded-lg bg-white text-sm"
                            disabled={!isEditable}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="west_boundary" className="text-sm font-semibold text-slate-700">West</Label>
                          <Input
                            id="west_boundary"
                            value={formData.west_boundary}
                            onChange={(e) => handleInputChange("west_boundary", e.target.value)}
                            placeholder="West boundary"
                            className="border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 h-9 rounded-lg bg-white text-sm"
                            disabled={!isEditable}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Land Appraisal Tab - Compact */}
              <TabsContent value="appraisal" className="mt-4">
                <div className="bg-white rounded-lg border border-slate-100 p-4">
                  <div className="mb-4">
                    <h3 className="text-base font-bold text-slate-900 mb-1">Land Appraisal</h3>
                    <p className="text-xs text-slate-500">Enter land classification and improvement details</p>
                  </div>

                  <div className="space-y-6">
                    {/* Land Appraisal Section */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-slate-900">Land Appraisal Details</h4>
                      </div>

                      <div className="overflow-hidden rounded-lg border border-slate-200">
                        <table className="w-full">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="text-left p-2 text-xs font-semibold text-slate-600">Classification</th>
                              <th className="text-left p-2 text-xs font-semibold text-slate-600">Sub-Class</th>
                              <th className="text-left p-2 text-xs font-semibold text-slate-600">Area</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {[0, 1, 2, 3].map((index) => (
                              <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2">
                                  <Select
                                    value={formData.landAppraisals[index]?.classification || "NONE"}
                                    onValueChange={(value) => handleRowInputChange("landAppraisals", index, "classification", value === "NONE" ? "" : value)}
                                    disabled={!isEditable}
                                  >
                                    <SelectTrigger className="border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 h-8 bg-white text-sm">
                                      <SelectValue placeholder="Select classification" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="NONE">-- None --</SelectItem>
                                      {landClassificationOptions.map((option) => (
                                        <SelectItem key={option} value={option}>
                                          {option}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </td>
                                <td className="p-2">
                                  <Select
                                    value={formData.landAppraisals[index]?.sub_class || "NONE"}
                                    onValueChange={(value) => handleRowInputChange("landAppraisals", index, "sub_class", value === "NONE" ? "" : value)}
                                    disabled={!isEditable || !formData.landAppraisals[index]?.classification}
                                  >
                                    <SelectTrigger className="border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 h-8 bg-white text-sm">
                                      <SelectValue placeholder={
                                        formData.landAppraisals[index]?.classification
                                          ? "Select sub-class"
                                          : "Select classification first"
                                      } />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="NONE">-- None --</SelectItem>
                                      {getSubClassOptions(formData.landAppraisals[index]?.classification).map((option) => (
                                        <SelectItem key={option} value={option}>
                                          {option}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </td>
                                <td className="p-2">
                                  <Input
                                    value={formData.landAppraisals[index]?.area}
                                    onChange={(e) => handleRowInputChange("landAppraisals", index, "area", e.target.value)}
                                    className="border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 h-8 bg-white text-sm"
                                    type="number"
                                    placeholder="Area"
                                    disabled={!isEditable}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Other Improvements Section */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-slate-900">Other Improvements</h4>
                      </div>

                      <div className="overflow-hidden rounded-lg border border-slate-200">
                        <table className="w-full">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="text-left p-2 text-xs font-semibold text-slate-600">Product Class</th>
                              <th className="text-left p-2 text-xs font-semibold text-slate-600">Number</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {[0, 1, 2, 3].map((index) => (
                              <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2">
                                  <Select
                                    value={formData.improvements[index]?.product_class || "NONE"}
                                    onValueChange={(value) => handleRowInputChange("improvements", index, "product_class", value === "NONE" ? "" : value)}
                                    disabled={!isEditable}
                                  >
                                    <SelectTrigger className="border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 h-8 bg-white text-sm">
                                      <SelectValue placeholder="Select product class" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="NONE">-- None --</SelectItem>
                                      {productClassOptions.map((option) => (
                                        <SelectItem key={option} value={option}>
                                          {option}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </td>
                                <td className="p-2">
                                  <Input
                                    value={formData.improvements[index]?.improvement_qty}
                                    onChange={(e) => handleRowInputChange("improvements", index, "improvement_qty", e.target.value)}
                                    className="border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 h-8 bg-white text-sm"
                                    type="number"
                                    placeholder="Qty"
                                    disabled={!isEditable}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Assessment Tab - Compact */}
              <TabsContent value="assessment" className="mt-4">
                <div className="bg-white rounded-lg border border-slate-100 p-4">
                  <div className="mb-4">
                    <h3 className="text-base font-bold text-slate-900 mb-1">Assessment</h3>
                    <p className="text-xs text-slate-500">Enter market value adjustments and property assessment details</p>
                  </div>

                  <div className="space-y-6">
                    {/* Market Value Section */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-slate-900">Market Value Adjustments</h4>

                      <div className="overflow-hidden rounded-lg border border-slate-200">
                        <table className="w-full">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="text-left p-2 text-xs font-semibold text-slate-600">Adj. Factor</th>
                              <th className="text-left p-2 text-xs font-semibold text-slate-600">% Adjustment</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {[0, 1, 2, 3].map((index) => (
                              <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2">
                                  <Input
                                    value={formData.marketValues[index]?.adj_factor}
                                    onChange={(e) => handleRowInputChange("marketValues", index, "adj_factor", e.target.value)}
                                    className="border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 h-8 bg-white text-sm"
                                    type="text"
                                    placeholder="#, #, #"
                                    disabled={!isEditable}
                                  />
                                </td>
                                <td className="p-2">
                                  <Input
                                    value={formData.marketValues[index]?.percent_adjustment}
                                    onChange={(e) => handleRowInputChange("marketValues", index, "percent_adjustment", e.target.value)}
                                    className="border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 h-8 bg-white text-sm"
                                    type="number"
                                    placeholder="%"
                                    disabled={!isEditable}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Property Assessment Section */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-slate-900">Property Assessment</h4>
                      </div>

                      <div className="overflow-hidden rounded-lg border-2 border-slate-200">
                        <table className="w-full">
                          <thead className="bg-blue-50">
                            <tr>
                              <th className="text-left p-2 text-xs font-bold text-slate-700">Kind</th>
                              <th className="text-left p-2 text-xs font-bold text-slate-700">Actual Use</th>
                              <th className="text-left p-2 text-xs font-bold text-slate-700">Assessment Level (%)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {[0, 1, 2, 3].map((index) => (
                              <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-2">
                                  <Select
                                    value={formData.propertyAssessments[index]?.kind || "NONE"}
                                    onValueChange={(value) => handleRowInputChange("propertyAssessments", index, "kind", value === "NONE" ? "" : value)}
                                    disabled={!isEditable}
                                  >
                                    <SelectTrigger className="border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 h-8 bg-white text-sm">
                                      <SelectValue placeholder="Select kind" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="NONE">-- None --</SelectItem>
                                      {kindOptions.map((option) => (
                                        <SelectItem key={option} value={option}>
                                          {option}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </td>
                                <td className="p-2">
                                  <Select
                                    value={formData.propertyAssessments[index]?.actual_use || "NONE"}
                                    onValueChange={(value) => handleRowInputChange("propertyAssessments", index, "actual_use", value === "NONE" ? "" : value)}
                                    disabled={!isEditable}
                                  >
                                    <SelectTrigger className="border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 h-8 bg-white text-sm">
                                      <SelectValue placeholder="Select actual use" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="NONE">-- None --</SelectItem>
                                      {actualUseOptions.map((option) => (
                                        <SelectItem key={option} value={option}>
                                          {option}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </td>
                                <td className="p-2">
                                  <Input
                                    value={formData.propertyAssessments[index]?.assessment_level}
                                    onChange={(e) => handleRowInputChange("propertyAssessments", index, "assessment_level", e.target.value)}
                                    className="border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 h-8 bg-white text-sm"
                                    type="number"
                                    placeholder="%"
                                    disabled={!isEditable}
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Previous Assessment Tab - Compact */}
              <TabsContent value="previous" className="mt-4">
                <div className="bg-white rounded-lg border border-slate-100 p-4">
                  <div className="mb-4">
                    <h3 className="text-base font-bold text-slate-900 mb-1">Previous Assessment</h3>
                    <p className="text-xs text-slate-500">Enter previous assessment details and memoranda</p>
                  </div>

                  <div className="space-y-6">
                    {/* Record of Superseded Assessment */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-1.5">
                        <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center">
                          <Calendar className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <h4 className="text-sm font-semibold text-slate-900">Record of Superseded Assessment</h4>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="space-y-3 bg-slate-50 rounded-lg p-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-sm font-semibold text-slate-700">Previous T.D. No.:</Label>
                              <Input
                                value={formData.previous_td_no}
                                onChange={(e) => handleInputChange("previous_td_no", e.target.value)}
                                className="border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 h-8 bg-white text-sm"
                                placeholder="Previous TD"
                                disabled={!isEditable}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="effectivity_year" className="text-sm font-semibold text-slate-700">Effectivity:</Label>
                              <Input
                                type="number"
                                id="effectivity_year"
                                min="1900"
                                max="2100"
                                value={formData.effectivity_year}
                                onChange={(e) => handleInputChange("effectivity_year", e.target.value)}
                                placeholder="YYYY"
                                className="border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 h-8 bg-white text-sm"
                                disabled={!isEditable}
                              />
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-sm font-semibold text-slate-700">Previous Owner:</Label>
                            <Input
                              value={formData.previous_owner}
                              onChange={(e) => handleInputChange("previous_owner", e.target.value)}
                              className="border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 h-8 bg-white text-sm"
                              placeholder="Previous owner"
                              disabled={!isEditable}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="taxability" className="text-sm font-semibold text-slate-700">Taxability:</Label>
                            <Select
                              value={formData.taxability}
                              onValueChange={(value) => handleInputChange("taxability", value)}
                              disabled={!isEditable}
                            >
                              <SelectTrigger className="border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 h-8 bg-white text-sm">
                                <SelectValue placeholder="Select taxability" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="taxable">TAXABLE</SelectItem>
                                <SelectItem value="exempt">EXEMPT</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-3 bg-slate-50 rounded-lg p-4">
                          <div className="space-y-1.5">
                            <Label className="text-sm font-semibold text-slate-700">Previous AV - Land:</Label>
                            <Input
                              value={formData.previous_av_land}
                              onChange={(e) => handleInputChange("previous_av_land", e.target.value)}
                              className="border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 h-8 bg-white text-sm"
                              placeholder="Previous land AV"
                              type="number"
                              step="0.01"
                              disabled={!isEditable}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-sm font-semibold text-slate-700">Previous AV - Improvements:</Label>
                            <Input
                              value={formData.previous_av_improvements}
                              onChange={(e) => handleInputChange("previous_av_improvements", e.target.value)}
                              className="border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 h-8 bg-white text-sm"
                              placeholder="Previous improvements AV"
                              type="number"
                              step="0.01"
                              disabled={!isEditable}
                            />
                          </div>

                        </div>
                      </div>
                    </div>

                    {/* MEMORANDA Section */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-1.5">
                        <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center">
                          <FileText className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <h4 className="text-sm font-semibold text-slate-900">Memoranda</h4>
                      </div>

                      <div className="bg-slate-50 rounded-lg p-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label htmlFor="memoranda_code" className="text-sm font-semibold text-slate-700">Memoranda Code:</Label>
                            <Input
                              id="memoranda_code"
                              value={formData.memoranda_code}
                              onChange={(e) => handleInputChange("memoranda_code", e.target.value)}
                              className="border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 h-8 bg-white uppercase text-sm"
                              disabled={!isEditable}
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="memoranda_paragraph" className="text-sm font-semibold text-slate-700">Memoranda Paragraph:</Label>
                            <textarea
                              id="memoranda_paragraph"
                              value={formData.memoranda_paragraph || ''}
                              onChange={(e) => handleInputChange("memoranda_paragraph", e.target.value)}
                              className="w-full border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 p-2 text-xs rounded-md bg-white min-h-[80px]"
                              disabled={!isEditable}
                              rows={3}
                            />
                          </div>
                        </div>

                        {/* Submit for Approval Button - Only show in edit mode */}
                        {isEditable && (
                          <div className="pt-4 border-t border-slate-200">
                            <div className="text-center">
                              <Button
                                onClick={handleSubmit}
                                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-4 text-sm font-semibold rounded-lg shadow-md shadow-emerald-100"
                                disabled={submitting}
                                size="lg"
                              >
                                {submitting ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Send className="w-4 h-4" />
                                )}
                                {submitting ? "Submitting..." : "Submit for Approval"}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Navigation Buttons - Compact */}
              <div className="flex items-center justify-between gap-3 pt-4 mt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={goToPreviousTab}
                  disabled={isFirstTab}
                  className="gap-1 rounded-lg border-slate-200 text-slate-600 hover:bg-slate-50 h-9 text-sm"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Previous
                </Button>

                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-0.5">
                    {tabOrder.map((tab, index) => (
                      <div
                        key={tab}
                        className={cn(
                          "w-1.5 h-1.5 rounded-full transition-colors",
                          currentTabIndex === index ? "bg-blue-600" : "bg-slate-300"
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-medium text-slate-500">
                    Step {currentTabIndex + 1} of {tabOrder.length}
                  </span>
                </div>

                <Button
                  type="button"
                  onClick={goToNextTab}
                  disabled={isLastTab}
                  className="gap-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white h-9 text-sm"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}