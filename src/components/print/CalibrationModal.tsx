import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Save, RotateCcw, Loader2, Gauge, LayoutTemplate, Search, X } from "lucide-react";
import { printAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

interface MappingItem {
    x: number;
    y: number;
    label: string;
    text?: string;
    fontSize?: number;
}

interface CalibrationMapping {
    [key: string]: MappingItem;
}

interface CalibrationModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCalibrated: () => void;
    recordId?: string | number;
    recordData?: any;
}

export function CalibrationModal({ open, onOpenChange, onCalibrated, recordId, recordData }: CalibrationModalProps) {
    const { toast } = useToast();
    const [mapping, setMapping] = useState<CalibrationMapping | null>(null);
    const [selectedField, setSelectedField] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [step, setStep] = useState<number>(0.1); // Precision step in cm
    const [searchQuery, setSearchQuery] = useState<string>("");

    // Helper to get actual value from recordData based on mapping label
    const getActualValue = (id: string, label: string) => {
        if (!recordData) return "N/A";

        // 1. Handle sub-lines first
        if (id.includes("_line")) {
            const baseKey = id.split('_line')[0];
            return getActualValue(baseKey, mapping?.[baseKey]?.label || "");
        }

        const l = (label || "").toLowerCase();
        const k = id.toLowerCase();

        // 2. Define helper functions FIRST (before they're used)
        const formatVal = (v: any) => {
            if (v === null || v === undefined || v === "") return "";
            const num = parseFloat(String(v).replace(/,/g, ''));
            return isNaN(num) ? "" : num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        };

        const getNumeric = (v: any) => {
            if (v === null || v === undefined || v === "") return 0;
            const num = parseFloat(String(v).replace(/,/g, ''));
            return isNaN(num) ? 0 : num;
        };

        const mround = (num: number, mult: number) => {
            if (!num || !mult) return 0;
            return Math.round(num / mult) * mult;
        };

        // 3. Parse JSON fields for lookup safely
        const parseSafely = (val: any) => {
            if (!val) return [];
            if (typeof val === 'object') return val; // Already parsed by backend/driver
            try {
                return JSON.parse(val);
            } catch (e) {
                console.error("JSON Parse Error:", e);
                return [];
            }
        };

        const landAppraisals = parseSafely(recordData.land_appraisals_json);
        const improvements = parseSafely(recordData.improvements_json);
        const marketValues = parseSafely(recordData.market_values_json);
        const assessments = parseSafely(recordData.assessments_json);

        // 4. Regex matching for List Items
        // Case: "Table R1 Class", "Table R2 Sub", etc. → land appraisals
        const tableRMatch = l.match(/table\s+r(\d+)/);
        if (tableRMatch) {
            const index = parseInt(tableRMatch[1]) - 1; // R1=0, R2=1, etc.
            const item = landAppraisals[index];
            if (item) {
                if (l.includes("sub")) return item.sub_class || "";
                if (l.includes("class")) return item.classification || "";
                if (l.includes("area")) return item.area || "";
                if (l.includes("unit")) return formatVal(item.unit_value_land || item.unit_value || "");
                if (l.includes("market")) return formatVal(item.market_value || "");
            }
            return "";
        }

        // Case: "Land 1: Kind" or "Land 1 Area" (backward compat)
        const landMatch = l.match(/land\s+(\d+)/);
        if (landMatch) {
            const index = parseInt(landMatch[1]) - 1;
            const item = landAppraisals[index];
            if (item) {
                if (l.includes("kind")) return item.classification || item.kind || "";
                if (l.includes("class") && !l.includes("kind")) return item.sub_class || "";
                if (l.includes("area")) return item.area || "";
                if (l.includes("uv") || l.includes("unit")) return formatVal(item.unit_value_land || item.unit_value || "");
                if (l.includes("mv") || l.includes("market")) return formatVal(item.market_value || "");
            }
        }

        // Case: "Plant: Kind", "Plant: Area", "Plant: UV", "Plant: MV" (rows 42-45, column K for MV)
        const plantMatch = l.match(/plant(?:\s+(\d+))?/);
        if (plantMatch && !l.includes("adj")) {
            const index = plantMatch[1] ? parseInt(plantMatch[1]) - 1 : 0;
            const item = improvements[index];
            if (item) {
                if (l.includes("kind") || l.includes("class")) return item.product_class || "";
                if (l.includes("area") || l.includes("qty")) return item.improvement_qty || "";
                if (l.includes("uv") || l.includes("unit")) return item.unit_value_improvement || "";
                if (l.includes("mv") || l.includes("market")) {
                    const mv = getNumeric(item.market_value || item.market_value_improvement || 0);
                    return mv > 0 ? formatVal(mv) : "";
                }
            }
        }

        // Plant Adjustment Percentages (G44, G47, G49, G52) - show as percentages
        if (l.includes("plant adj") && l.includes("%")) {
            const adjMatch = l.match(/adj\s+(\d+)/);
            if (adjMatch && marketValues.length > 0) {
                const adjIndex = parseInt(adjMatch[1]) - 1;
                const adjFactor = marketValues[0].adj_factor || "";
                const adjParts = String(adjFactor).split(',').map((p: string) => p.trim());
                const adj = adjParts[adjIndex];
                if (adj) {
                    const pctNum = parseFloat(adj) || 0;
                    return pctNum > 0 ? `${Math.round(pctNum)}%` : "";
                }
            }
            return "";
        }

        // 4. Hardcoded Mappings for Top-Level Fields
        if ((l.includes("owner") || k.includes("owner")) && !l.includes("addr") && !l.includes("prev owner") && !k.includes("a72") && !k.includes("l39")) return recordData.owner_name || "";
        if (l.includes("admin") && !l.includes("addr") && !k.includes("l39")) return recordData.administrator_name || "";
        if (l.includes("owner addr")) return recordData.owner_address || "";
        if ((l.includes("admin") && l.includes("addr")) || l.includes("admin addr")) return recordData.administrator_address || "";

        if (l.includes("pin") || k.includes("pin")) return recordData.pin || recordData.arf_no || "";
        if (l.includes("arf") || k.includes("arf")) return recordData.arf_no || "";
        if (l.includes("memoranda")) return recordData.memoranda_paragraph || recordData.memoranda || "";

        if (l.includes("location") || l.includes("street")) return recordData.property_location || "";
        if (l.includes("barangay")) return recordData.property_barangay || "";
        if (l.includes("municipality")) return recordData.property_municipality || "";

        if (l.includes("cadastral") || l.includes("lot no") || k.includes("cln")) return recordData.cln || "";
        if (l.includes("title") || k.includes("title") || l.includes("tct")) return recordData.oct_tct_no || "";
        if (l.includes("survey") || k.includes("survey")) return recordData.survey_no || "";

        if (l.includes("north")) return recordData.north_boundary || "";
        if (l.includes("east")) return recordData.east_boundary || "";
        if (l.includes("south")) return recordData.south_boundary || "";
        if (l.includes("west")) return recordData.west_boundary || "";

        // Manual recalculation to match Excel/PDF generator exactly
        let totalLandVal = 0;
        landAppraisals.forEach((item: any) => {
            totalLandVal += getNumeric(item.market_value || item.marketValue);
        });

        let totalImprVal = 0;
        improvements.forEach((item: any) => {
            // Improvements use 'market_value_improvement' in JSON, but sometimes 'market_value'
            totalImprVal += getNumeric(item.market_value_improvement || item.market_value || item.marketValue);
        });

        // Use direct recordData properties as fallbacks if manual sum is 0
        const l36_base = totalLandVal || getNumeric(recordData.land_appraisal_total || recordData.market_value);
        const l37_base = totalImprVal || getNumeric(recordData.improvements_total || recordData.total_market_value_improvements || recordData.market_value_improvement);

        // Apply Percent Adjustment if present (usually index 0 in marketValues)
        let pctAdj = 0;
        if (marketValues.length > 0) {
            pctAdj = getNumeric(marketValues[0].percent_adjustment) / 100;
        }

        const l36_val = (pctAdj !== 0) ? mround(l36_base * pctAdj, 10) : l36_base;
        const l37_val = (pctAdj !== 0) ? mround(l37_base * pctAdj, 10) : l37_base;
        const l38_val = l36_val + l37_val;

        if (k.includes("l36")) return formatVal(l36_val);
        if (k.includes("l37")) return formatVal(l37_val);
        if (k.includes("l38")) return formatVal(l38_val);
        if (k.includes("l39")) return recordData.owner_administrator || recordData.owner_name || "";

        if (l.includes("total land mv") || l.includes("total mv land")) return formatVal(l36_val);
        if (l.includes("total impr mv")) return formatVal(l37_val);
        if (l.includes("total mv plants") || l.includes("total plant mv")) return formatVal(totalImprVal);

        // 5b. SHEET 1 K53 CALCULATION (Sum of K42-K45)
        if (k.includes("k53") || (l.includes("total") && l.includes("plant"))) {
            let k53_total = 0;
            improvements.forEach((item: any, index: number) => {
                if (index < 4) {
                    const mv = getNumeric(item.market_value || item.market_value_improvement || item.unitValue || 0);
                    k53_total += mv;
                }
            });
            return k53_total > 0 ? formatVal(k53_total) : "0.00";
        }

        // 5c. SHEET 2 G58 CALCULATION (Sum of G54-G57)
        if (k.includes("g58")) {
            let g58_total = 0;
            assessments.forEach((item: any) => {
                const mv = getNumeric(item.market_value || item.adjusted_market_value || 0);
                g58_total += mv;
            });
            return g58_total > 0 ? formatVal(g58_total) : "0.00";
        }

        // 5d. SHEET 2 M58 CALCULATION (Sum of M54-M57 - Assessment Values)
        if (k.includes("m58")) {
            let m58_total = 0;
            assessments.forEach((item: any) => {
                const mv = getNumeric(item.market_value || item.adjusted_market_value || 0);
                const lvl = getNumeric(item.assessment_level || 0);
                const levelDecimal = lvl <= 1 ? lvl : lvl / 100;
                const av = mround(mv * levelDecimal, 10);
                m58_total += av;
            });
            return m58_total > 0 ? formatVal(m58_total) : "0.00";
        }

        // 6. SHEET 2 (PAGE 2) MAPPINGS
        const getFormattedDate = (dateStr: string | null | undefined) => {
            if (!dateStr) return null;
            try {
                const d = new Date(dateStr);
                return isNaN(d.getTime()) ? null : d;
            } catch (e) { return null; }
        };

        const apprDate = getFormattedDate(recordData.approval_date || recordData.approved_at);
        const ctcDate = getFormattedDate(recordData.ctc_issued_on);

        if (l.includes("sworn")) {
            if (!apprDate) return "";
            if (l.includes("day")) {
                const day = apprDate.getDate();
                const suffix = ["th", "st", "nd", "rd"][(day % 10 > 3 || Math.floor(day % 100 / 10) === 1) ? 0 : day % 10];
                return `${day}${suffix}`;
            }
            if (l.includes("month")) return apprDate.toLocaleDateString('default', { month: 'long' });
            if (l.includes("year")) return apprDate.getFullYear().toString().slice(-2);
        }

        if (l.includes("ctc no") || k.includes("ctc_no")) return recordData.ctc_no || "";
        if (l.includes("ctc month")) {
            if (!ctcDate) return "";
            return `${ctcDate.toLocaleDateString('default', { month: 'long' })} ${ctcDate.getDate()},`;
        }
        if (l.includes("ctc year")) return ctcDate ? ctcDate.getFullYear().toString().slice(-2) : "";
        if (l.includes("ctc issued at") || k.includes("ctc_issued_at")) return recordData.ctc_issued_at || "";

        if (l.includes("prev td")) return recordData.previous_td_no || recordData.previous_td || "";
        if (l.includes("eff year")) return recordData.effectivity_year || "";
        if (k.includes("a72")) return recordData.previous_owner2 || "";
        if (k.includes("e72")) return formatVal(recordData.previous_av_land2);
        if (k.includes("h72")) return formatVal(recordData.previous_av_improvements2);
        if (k.includes("l72")) {
            const sum2 = getNumeric(recordData.previous_av_land2) + getNumeric(recordData.previous_av_improvements2);
            return sum2 > 0 ? `T = ${formatVal(sum2)}` : "";
        }
        if (l.includes("prev owner")) return recordData.previous_owner || "";
        if (l.includes("prev land av")) return formatVal(recordData.previous_av_land);
        if (l.includes("prev impr av")) return formatVal(recordData.previous_av_improvements);
        if (l.includes("total prev av") || k.includes("l71")) {
            const sum = getNumeric(recordData.previous_av_land) + getNumeric(recordData.previous_av_improvements);
            return sum > 0 ? formatVal(sum) : "";
        }
        if (l.includes("words")) return recordData.total_market_value_words || "";

        const assmMatch = l.match(/assm\s+(\d+)/);
        if (assmMatch) {
            const index = parseInt(assmMatch[1]) - 1;
            const item = assessments[index];
            if (item) {
                if (l.includes("kind")) return item.actual_use_name || item.classification || item.kind || "";
                if (l.includes("use")) return item.actual_use_code || item.actual_use || "";
                
                // MV (Market Value) - 2 decimal format
                if (l.includes("mv") && !l.includes("lvl") && !l.includes("av")) {
                    const adjMv = getNumeric(item.adjusted_market_value || item.market_value || 0);
                    return adjMv > 0 ? formatVal(adjMv) : "";
                }
                
                // Lvl (Assessment Level) - percentage format (like 24%)
                if (l.includes("lvl")) {
                    const lvl = getNumeric(item.assessment_level || 0);
                    if (lvl <= 1) {
                        // If stored as 0-1 decimal, convert to percentage
                        return lvl > 0 ? `${Math.round(lvl * 100)}%` : "";
                    } else {
                        // If stored as percentage (1-100), use directly
                        return lvl > 0 ? `${Math.round(lvl)}%` : "";
                    }
                }
                
                // AV (Assessed Value) - calculated as MV * Level%
                if (l.includes("av")) {
                    const mv = getNumeric(item.adjusted_market_value || item.market_value || 0);
                    const lvl = getNumeric(item.assessment_level || 0);
                    const levelDecimal = lvl <= 1 ? lvl : lvl / 100;
                    const av = mround(mv * levelDecimal, 10);
                    return av > 0 ? formatVal(av) : "";
                }
            }
        }

        // 7. Final fallback - check recordData keys directly
        const cleanLabel = l.replace(/\s+/g, '_');
        if (recordData[cleanLabel] !== undefined) return String(recordData[cleanLabel]);

        return "";
    };

    const handleAddLine = () => {
        if (!mapping || !selectedField) return;

        // Use a clearer base key extraction
        const baseKey = selectedField.split('_line')[0];
        const newMapping = { ...mapping };

        // 1. Find ALL members of this group (Base + all previous lines)
        const groupKeys = Object.keys(mapping).filter(k => k === baseKey || k.startsWith(`${baseKey}_line`));

        // 2. Identify the current stack's baseline (the lowest Y) BEFORE we shift anything
        const originalBaselineY = Math.min(...groupKeys.map(k => mapping[k].y));

        // 3. Constant shift amount (0.35cm) for all fields
        const shiftAmount = 0.35;

        // 4. Shift EVERY existing line in this group UP (+shiftAmount)
        groupKeys.forEach(key => {
            newMapping[key] = {
                ...newMapping[key],
                y: parseFloat((newMapping[key].y + shiftAmount).toFixed(2))
            };
        });

        // 4. Create the NEW line at the ORIGINAL baseline spot
        // Important: Use selectedField (not baseKey) as template to carry over X and Font Size changes
        const template = mapping[selectedField];
        const newLineKey = `${baseKey}_line${Date.now()}`;

        newMapping[newLineKey] = {
            ...template,
            y: originalBaselineY,
            label: `${mapping[baseKey].label} (Next Line)`,
            text: ""
        };

        setMapping(newMapping);
        setSelectedField(newLineKey);
    };

    const removeLine = (key: string) => {
        if (!mapping || !key.includes("_line")) return;

        const baseKey = key.split('_line')[0];
        const newMapping = { ...mapping };
        delete newMapping[key];

        // Shift remaining lines in the group back DOWN (-0.35cm)
        const shiftAmount = 0.35;

        const groupLines = Object.keys(newMapping).filter(k => k === baseKey || k.startsWith(`${baseKey}_line`));
        groupLines.forEach(k => {
            newMapping[k] = {
                ...newMapping[k],
                y: parseFloat((newMapping[k].y - shiftAmount).toFixed(2))
            };
        });

        console.log(`Remove Line: Shifted group back down.`);
        setMapping(newMapping);
        setSelectedField(baseKey);
    };

    const updateLineText = (key: string, text: string) => {
        if (!mapping) return;
        setMapping({
            ...mapping,
            [key]: { ...mapping[key], text }
        });
    };

    useEffect(() => {
        if (open) {
            fetchMapping();
        }
    }, [open, recordId]);

    const fetchMapping = async () => {
        try {
            setLoading(true);
            const data = await printAPI.getCalibration(recordId);
            setMapping(data);
            if (Object.keys(data).length > 0 && !selectedField) {
                setSelectedField(Object.keys(data)[0]);
            }
        } catch (error) {
            console.error("Failed to fetch calibration:", error);
            toast({
                title: "Error",
                description: "Failed to load calibration settings",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const updateFontSize = (delta: number) => {
        if (!mapping || !selectedField) return;
        const current = { ...mapping[selectedField] };
        const newSize = Math.max(4, Math.min(24, (current.fontSize || 10.5) + delta));

        setMapping({
            ...mapping,
            [selectedField]: { ...current, fontSize: parseFloat(newSize.toFixed(1)) }
        });
    };

    const handleMove = (direction: 'up' | 'down' | 'left' | 'right') => {
        if (!mapping || !selectedField) return;

        const current = { ...mapping[selectedField] };

        // ReportLab origin is bottom-left. Y increases upwards.
        switch (direction) {
            case 'up': current.y = parseFloat((current.y + step).toFixed(2)); break;
            case 'down': current.y = parseFloat((current.y - step).toFixed(2)); break;
            case 'left': current.x = parseFloat((current.x - step).toFixed(2)); break;
            case 'right': current.x = parseFloat((current.x + step).toFixed(2)); break;
        }

        const newMapping = {
            ...mapping,
            [selectedField]: current
        };

        setMapping(newMapping);
    };

    const handleSave = async () => {
        if (!mapping) return;
        try {
            setSaving(true);
            // Save specifically for this record
            await printAPI.updateCalibration(mapping, recordId);
            toast({
                title: "Calibration Applied",
                description: "Record-specific coordinates updated.",
            });
            onCalibrated();
            onOpenChange(false);
        } catch (error) {
            console.error("Failed to save calibration:", error);
            toast({
                title: "Error",
                description: "Failed to save changes",
                variant: "destructive",
            });
        } finally {
            setSaving(false);
        }
    };

    const handleSaveAsTemplate = async () => {
        if (!mapping) return;
        try {
            setSaving(true);
            // Save as global master template (this also deletes ALL record-specific files on the backend)
            await printAPI.updateCalibration(mapping);

            toast({
                title: "Template Saved",
                description: "Coordinates saved as global default. All record-specific overrides have been cleared.",
            });

            onCalibrated();
            onOpenChange(false);
        } catch (error) {
            console.error("Failed to save template:", error);
            toast({
                title: "Error",
                description: "Failed to save template settings",
                variant: "destructive",
            });
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        fetchMapping();
    };

    if (!mapping) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[820px] w-full rounded-2xl border-0 shadow-2xl p-0 overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 text-white relative">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl font-bold pr-8">
                            <Gauge className="w-6 h-6 shrink-0" />
                            Precision Calibration
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-emerald-50/80 text-xs mt-1 italic">Record-Specific Alignment</p>
                </div>

                <div className="flex flex-row gap-0 overflow-hidden" style={{ maxHeight: 'calc(100vh - 180px)' }}>
                    {/* LEFT COLUMN: Field Selector */}
                    <div className="w-[300px] shrink-0 border-r border-slate-200 overflow-y-auto p-3 bg-white">
                        <div className="space-y-3">
                            <div>
                                <Label htmlFor="field-select" className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Field</Label>
                            </div>
                            <Select value={selectedField} onValueChange={setSelectedField}>
                                <SelectTrigger id="field-select" className="border-slate-300 bg-white h-auto min-h-[60px] w-full p-2">
                                    <div className="flex flex-col items-start gap-1 w-full text-left">
                                        <div className="text-sm font-semibold text-slate-900 truncate w-full">
                                            {selectedField ? (mapping[selectedField]?.label || selectedField).split('(')[0].trim() : "Select a field"}
                                        </div>
                                        {selectedField && mapping[selectedField] && (
                                            <>
                                                <div className="text-[10px] text-slate-500 font-mono">
                                                    {mapping[selectedField].x.toFixed(1)}cm × {mapping[selectedField].y.toFixed(1)}cm
                                                </div>
                                                <div className="text-xs text-slate-700 font-medium truncate w-full block">
                                                    {getActualValue(selectedField, mapping[selectedField]?.label) || "—"}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </SelectTrigger>
                                <SelectContent className="max-h-[75vh] w-[300px]" onCloseAutoFocus={() => setSearchQuery("")}>
                                    <div className="sticky top-0 z-20 bg-white border-b border-slate-200 p-2">
                                        <div className="relative">
                                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                                            <input
                                                className="w-full pl-7 pr-7 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-slate-50"
                                                placeholder="Search label or cell (e.g. H28)..."
                                                value={searchQuery}
                                                onChange={e => setSearchQuery(e.target.value)}
                                                onKeyDown={e => e.stopPropagation()}
                                                onClick={e => e.stopPropagation()}
                                            />
                                            {searchQuery && (
                                                <button className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={e => { e.stopPropagation(); setSearchQuery(""); }}>
                                                    <X className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {(() => {
                                        const q = searchQuery.toLowerCase().trim();

                                        const groups: { [key: string]: [string, MappingItem][] } = {
                                            "General": [],
                                            "Boundaries": [],
                                            "Land Appraisal": [],
                                            "Plants & Improvements": [],
                                            "Land II": [],
                                            "Assessment": [],
                                            "Sworn / CTC": [],
                                            "Previous Record": [],
                                            "Other": []
                                        };

                                        Object.entries(mapping).forEach(([key, item]) => {
                                            const label = item.label || key;
                                            const cellRef = key.includes('!') ? key.split('!')[1] : key;
                                            const lc = label.toLowerCase();
                                            const actualVal = String(getActualValue(key, label) ?? "").toLowerCase();
                                            if (q && !lc.includes(q) && !cellRef.toLowerCase().includes(q) && !key.toLowerCase().includes(q) && !actualVal.includes(q)) return;

                                            const sn = key.startsWith("Sheet2") ? "Sheet2" : "Sheet1";

                                            if (sn === "Sheet1") {
                                                if (lc.includes("north") || lc.includes("east") || lc.includes("south") || lc.includes("west")) {
                                                    groups["Boundaries"].push([key, item]);
                                                } else if (
                                                    lc.includes("table r") ||
                                                    lc.includes("total land mv") ||
                                                    lc.includes("total mv land") ||
                                                    lc.includes("total mv") ||
                                                    cellRef.startsWith("J3") ||
                                                    cellRef === "J35" ||
                                                    cellRef === "J36"
                                                ) {
                                                    groups["Land Appraisal"].push([key, item]);
                                                } else if (
                                                    lc.includes("plant") ||
                                                    lc.includes("k52") ||
                                                    lc.includes("k53") ||
                                                    cellRef.startsWith("H4") ||
                                                    cellRef.startsWith("I4") ||
                                                    cellRef.startsWith("J4") ||
                                                    cellRef.startsWith("K4") ||
                                                    cellRef === "K52" ||
                                                    cellRef === "K53" ||
                                                    cellRef.startsWith("G4") ||
                                                    cellRef.startsWith("G5")
                                                ) {
                                                    groups["Plants & Improvements"].push([key, item]);
                                                } else if (
                                                    lc.includes("land ii") ||
                                                    cellRef.startsWith("E58") ||
                                                    cellRef.startsWith("G58") ||
                                                    cellRef.startsWith("H58") ||
                                                    cellRef.startsWith("H59") ||
                                                    cellRef.startsWith("J58")
                                                ) {
                                                    groups["Land II"].push([key, item]);
                                                } else {
                                                    groups["General"].push([key, item]);
                                                }
                                            } else {
                                                if (lc.includes("sworn") || lc.includes("ctc")) {
                                                    groups["Sworn / CTC"].push([key, item]);
                                                } else if (
                                                    lc.includes("assm") ||
                                                    lc.includes("total assm") ||
                                                    lc.includes("total land mv") ||
                                                    lc.includes("total impr mv") ||
                                                    lc.includes("words") ||
                                                    cellRef === "L36" || cellRef === "L37" ||
                                                    cellRef === "L38" || cellRef === "L39" ||
                                                    cellRef === "G58" || cellRef === "M58" ||
                                                    cellRef.startsWith("G5") ||
                                                    cellRef.startsWith("K5") ||
                                                    cellRef.startsWith("M5")
                                                ) {
                                                    groups["Assessment"].push([key, item]);
                                                } else if (
                                                    lc.includes("prev") ||
                                                    lc.includes("eff year") ||
                                                    cellRef.startsWith("E67") ||
                                                    cellRef.startsWith("B69") ||
                                                    cellRef.startsWith("G70") ||
                                                    cellRef.startsWith("E71") ||
                                                    cellRef.startsWith("H71") ||
                                                    cellRef.startsWith("L71") ||
                                                    cellRef.startsWith("A72") ||
                                                    cellRef.startsWith("E72") ||
                                                    cellRef.startsWith("H72") ||
                                                    cellRef.startsWith("L72")
                                                ) {
                                                    groups["Previous Record"].push([key, item]);
                                                } else {
                                                    groups["Other"].push([key, item]);
                                                }
                                            }
                                        });

                                        const filteredGroups = Object.entries(groups).filter(([_, items]) => items.length > 0);
                                        if (filteredGroups.length === 0) {
                                            return (
                                                <div className="py-8 text-center text-xs text-slate-400 italic">
                                                    No fields match "{searchQuery}"
                                                </div>
                                            );
                                        }
                                        return filteredGroups.map(([groupName, items]) => (
                                                <SelectGroup key={groupName}>
                                                    <SelectLabel className="px-2.5 py-2 text-[10px] font-bold text-slate-700 bg-slate-50 sticky top-0 z-10 uppercase tracking-wider border-b border-slate-200">
                                                        {groupName}
                                                    </SelectLabel>
                                                    {items
                                                        .sort((a, b) => (a[1].label || a[0]).localeCompare(b[1].label || b[0]))
                                                        .map(([key, item]) => {
                                                        const displayLabel = (item.label || key).split('(')[0].trim();
                                                        const cellRef = key.includes('!') ? key.split('!')[1] : key;
                                                        const value = getActualValue(key, item.label);
                                                        const isNewField = key.match(/M(54|55|56|57|58)|K39|J45|J47|A61|H28/) !== null;
                                                        return (
                                                            <SelectItem key={key} value={key} className={`cursor-pointer focus:bg-emerald-50 ${isNewField ? 'bg-red-50 hover:bg-red-100' : ''}`}>
                                                                <div className={`flex flex-col items-start gap-1 py-1 ${isNewField ? 'border-l-4 border-red-400 pl-2' : ''}`}>
                                                                    <div className="flex items-baseline gap-2 w-full">
                                                                        <span className={`font-semibold text-sm ${isNewField ? 'text-red-900' : 'text-slate-900'}`}>
                                                                            {displayLabel}
                                                                            {isNewField && <span className="ml-1 text-[10px] bg-red-300 text-red-900 px-1.5 py-0.5 rounded font-bold">NEW</span>}
                                                                        </span>
                                                                        <span className="text-[10px] bg-blue-100 text-blue-700 font-mono font-bold px-1.5 py-0.5 rounded">
                                                                            {cellRef}
                                                                        </span>
                                                                        <span className="text-[9px] text-slate-400 font-mono">
                                                                            {item.x.toFixed(1)}×{item.y.toFixed(1)}
                                                                        </span>
                                                                    </div>
                                                                    {value && (
                                                                        <div className="text-xs text-slate-600 font-medium truncate max-w-[240px]">
                                                                            {value}
                                                                        </div>
                                                                    )}
                                                                    {!value && (
                                                                        <div className="text-[9px] text-slate-400 italic">
                                                                            No data
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </SelectItem>
                                                        );
                                                    })}
                                                </SelectGroup>
                                            ));
                                    })()}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Controls */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-5">
                        <div className="grid gap-5">

                            {selectedField && (
                                <div className="flex flex-col items-center gap-5 p-4 sm:p-5 bg-slate-50/50 rounded-2xl border border-slate-100 shadow-inner">
                                    <div className="w-full space-y-4">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between px-1">
                                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Original Record Value</Label>
                                                <span className="text-[9px] font-bold text-slate-300 italic">Read-only Reference</span>
                                            </div>
                                            <div className="p-2.5 bg-slate-100/50 rounded-lg border border-slate-200 text-[11px] font-medium text-slate-500 leading-relaxed min-h-[40px] shadow-inner select-all">
                                                {getActualValue(selectedField, mapping[selectedField].label)}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between px-1">
                                                <Label className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Current Print Line Content</Label>
                                                {selectedField.includes("_line") && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => removeLine(selectedField)}
                                                        className="h-5 text-rose-500 hover:text-rose-600 text-[9px] font-bold p-0 px-2"
                                                    >
                                                        REMOVE LINE
                                                    </Button>
                                                )}
                                            </div>
                                            <textarea
                                                className="w-full p-3 bg-white border-2 border-emerald-100 rounded-xl text-xs font-bold text-emerald-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none min-h-[80px] shadow-sm transition-all"
                                                value={mapping[selectedField].text ?? getActualValue(selectedField, mapping[selectedField].label)}
                                                onChange={(e) => updateLineText(selectedField, e.target.value)}
                                                placeholder="Cut/Trim text here to split into multiple lines..."
                                            />
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleAddLine}
                                                className="w-full h-9 border-dashed border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300 text-[10px] font-bold rounded-xl transition-all"
                                            >
                                                + ADD ANOTHER LINE & SHIFT CURRENT UP
                                            </Button>
                                        </div>
                                    </div>

                                    <Separator className="bg-slate-200/50" />

                                    <div className="grid grid-cols-2 gap-3 w-full">
                                        <div className="text-center space-y-1 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CM COORDINATES</div>
                                            <div className="text-lg font-black text-emerald-600 font-mono flex items-center justify-center gap-1.5">
                                                <span className="text-slate-300">X</span> {mapping[selectedField].x.toFixed(2)}
                                                <span className="text-slate-200">/</span>
                                                <span className="text-slate-300">Y</span> {mapping[selectedField].y.toFixed(2)}
                                            </div>
                                        </div>

                                        <div className="text-center space-y-1 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">FONT SIZE (PT)</div>
                                            <div className="flex items-center justify-center gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 rounded-md hover:bg-rose-50 hover:text-rose-600"
                                                    onClick={() => updateFontSize(-0.5)}
                                                >
                                                    <span className="text-lg font-bold">−</span>
                                                </Button>
                                                <span className="text-lg font-black text-emerald-600 font-mono w-10">
                                                    {(mapping[selectedField].fontSize || 10.5).toFixed(1)}
                                                </span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 rounded-md hover:bg-emerald-50 hover:text-emerald-600"
                                                    onClick={() => updateFontSize(0.5)}
                                                >
                                                    <span className="text-lg font-bold">+</span>
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-[9px] text-slate-400 font-medium italic -mt-2">Use arrows & +/- below to fine-tune</p>

                                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                                        <div />
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-11 w-11 sm:h-13 sm:w-13 rounded-2xl shadow-lg border-emerald-100 bg-white hover:bg-emerald-500 hover:text-white transition-all active:scale-95"
                                            onClick={() => handleMove('up')}
                                        >
                                            <ArrowUp className="w-5 h-5 sm:w-6 sm:h-6" />
                                        </Button>
                                        <div />

                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-11 w-11 sm:h-13 sm:w-13 rounded-2xl shadow-lg border-emerald-100 bg-white hover:bg-emerald-500 hover:text-white transition-all active:scale-95"
                                            onClick={() => handleMove('left')}
                                        >
                                            <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                                        </Button>
                                        <div className="flex items-center justify-center">
                                            <div className="w-3 h-3 bg-emerald-100 rounded-full flex items-center justify-center">
                                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                            </div>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-11 w-11 sm:h-13 sm:w-13 rounded-2xl shadow-lg border-emerald-100 bg-white hover:bg-emerald-500 hover:text-white transition-all active:scale-95"
                                            onClick={() => handleMove('right')}
                                        >
                                            <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
                                        </Button>

                                        <div />
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-11 w-11 sm:h-13 sm:w-13 rounded-2xl shadow-lg border-emerald-100 bg-white hover:bg-emerald-500 hover:text-white transition-all active:scale-95"
                                            onClick={() => handleMove('down')}
                                        >
                                            <ArrowDown className="w-5 h-5 sm:w-6 sm:h-6" />
                                        </Button>
                                        <div />
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-col sm:flex-row items-center justify-between px-2 bg-slate-100/50 p-2 rounded-lg border border-dashed border-slate-200 gap-2">
                                <Label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Step Sensitivity</Label>
                                <div className="flex gap-1">
                                    {[0.05, 0.1, 0.5].map((s) => (
                                        <Button
                                            key={s}
                                            variant={step === s ? "default" : "ghost"}
                                            size="sm"
                                            className={cn(
                                                "h-7 px-1.5 text-[9px] font-bold rounded-md transition-all",
                                                step === s ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "text-slate-400 hover:text-slate-600"
                                            )}
                                            onClick={() => setStep(s)}
                                        >
                                            {s} cm
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>


                <DialogFooter className="flex flex-row items-center justify-between gap-2 p-4 bg-slate-50 border-t border-slate-100">
                    <Button variant="ghost" onClick={handleReset} className="px-2 sm:px-3 gap-1 text-slate-400 hover:text-slate-600 font-bold text-[10px] uppercase tracking-wider h-9">
                        <RotateCcw className="w-3 h-3" />
                        <span className="hidden xs:inline">Reset</span>
                    </Button>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={handleSaveAsTemplate}
                            disabled={saving}
                            className="border-amber-200 text-amber-700 hover:bg-amber-50 gap-1.5 px-3 font-bold uppercase tracking-wider text-[10px] h-9"
                        >
                            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <LayoutTemplate className="w-3.5 h-3.5" />}
                            <span>Template</span>
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-emerald-600 hover:bg-emerald-700 gap-1.5 px-4 shadow-lg shadow-emerald-500/20 font-bold uppercase tracking-wider text-[10px] h-9"
                        >
                            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            Apply
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}