import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Save, RotateCcw, Loader2, Gauge, LayoutTemplate } from "lucide-react";
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

        // 2. Parse JSON fields for lookup safely
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

        // 3. Regex matching for List Items (Land 1, Table R2, etc.)
        // Case: "Land 1: Kind" or "Land 1 Area"
        const landMatch = l.match(/land\s+(\d+)/);
        if (landMatch) {
            const index = parseInt(landMatch[1]) - 1;
            const item = landAppraisals[index];
            if (item) {
                if (l.includes("kind") || l.includes("class")) return item.classification || item.kind || "";
                if (l.includes("area")) return item.area || "";
                if (l.includes("uv") || l.includes("unit")) return item.unit_value || "";
                if (l.includes("mv") || l.includes("market")) return item.market_value || "";
            }
        }

        // Case: "Table R2 Class"
        const tableMatch = l.match(/r(\d+)/);
        if (tableMatch) {
            const index = parseInt(tableMatch[1]) - 2; // R2 is index 0 in sub-table usually
            const item = improvements[index];
            if (item) {
                if (l.includes("class")) return item.product_class || "";
                if (l.includes("area") || l.includes("qty")) return item.improvement_qty || "";
                if (l.includes("unit")) return item.unit_value_improvement || "";
                if (l.includes("market")) return item.market_value || "";
            }
        }

        // 4. Hardcoded Mappings for Top-Level Fields
        if ((l.includes("owner") || k.includes("owner")) && !l.includes("addr")) return recordData.owner_name || "";
        if (l.includes("admin") && !l.includes("addr")) return recordData.administrator_name || "";
        if (l.includes("owner addr")) return recordData.owner_address || "";
        if (l.includes("admin addr")) return recordData.administrator_address || "";

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

        if (l.includes("total mv land")) return recordData.market_value || "";
        if (l.includes("total mv plants")) return recordData.total_market_value_plants || "";

        // 5. Final fallback - check recordData keys directly
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

        // 3. Determine shift amount (0.45cm for Boundaries, 0.55cm for others)
        const label = mapping[baseKey]?.label || "";
        const isBoundary = label.includes("North") || label.includes("East") || label.includes("South") || label.includes("West");
        const shiftAmount = isBoundary ? 0.45 : 0.55;

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

        // Shift remaining lines in the group back DOWN (-0.45cm for Boundaries, -0.55cm for others)
        const label = newMapping[baseKey]?.label || "";
        const isBoundary = label.includes("North") || label.includes("East") || label.includes("South") || label.includes("West");
        const shiftAmount = isBoundary ? 0.45 : 0.55;

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
            // 1. Save as global master template
            await printAPI.updateCalibration(mapping);

            // 2. If we're currently on a specific record, apply it there too
            if (recordId) {
                await printAPI.updateCalibration(mapping, recordId);
            }

            toast({
                title: "Template Saved & Applied",
                description: recordId
                    ? "Coordinates saved as global default AND applied to this record."
                    : "Coordinates saved as global default for all future records.",
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
                    <div className="w-[260px] shrink-0 border-r border-slate-100 overflow-y-auto p-4 bg-white">
                        <div className="space-y-2">
                            <Label htmlFor="field-select" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Select Field to Adjust</Label>
                            <Select value={selectedField} onValueChange={setSelectedField}>
                                <SelectTrigger id="field-select" className="border-slate-200 bg-slate-50/50 h-10 w-full">
                                    <SelectValue placeholder="Choose a field" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[80vh] w-[220px]">
                                    {(() => {
                                        const groups: { [key: string]: [string, MappingItem][] } = {
                                            "General Details": [],
                                            "Boundaries": [],
                                            "Land Appraisal (I)": [],
                                            "Plants & Trees": [],
                                            "Land Appraisal (II)": [],
                                            "Others": []
                                        };

                                        Object.entries(mapping).forEach(([key, item]) => {
                                            const label = item.label || key;
                                            if (label.includes("North") || label.includes("East") || label.includes("South") || label.includes("West")) {
                                                groups["Boundaries"].push([key, item]);
                                            } else if (label.includes("Land 1") || label.includes("Land 3") || label.includes("Land 4") || label.includes("Total MV Land")) {
                                                groups["Land Appraisal (I)"].push([key, item]);
                                            } else if (label.includes("Plant") || label.includes("Total MV Plants")) {
                                                groups["Plants & Trees"].push([key, item]);
                                            } else if (label.includes("Land II")) {
                                                groups["Land Appraisal (II)"].push([key, item]);
                                            } else if (["PIN", "Memoranda", "Owner", "Admin", "Street", "Barangay", "Municipality", "Title", "Lot No"].some(k => label.includes(k))) {
                                                groups["General Details"].push([key, item]);
                                            } else {
                                                groups["Others"].push([key, item]);
                                            }
                                        });

                                        return Object.entries(groups).map(([groupName, items]) => (
                                            items.length > 0 && (
                                                <SelectGroup key={groupName}>
                                                    <SelectLabel className="px-2 py-1.5 text-[10px] font-black text-emerald-600 bg-emerald-50/50 uppercase tracking-widest">
                                                        {groupName}
                                                    </SelectLabel>
                                                    {items.map(([key, item]) => (
                                                        <SelectItem key={key} value={key}>
                                                            {item.label || key}
                                                        </SelectItem>
                                                    ))}
                                                </SelectGroup>
                                            )
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