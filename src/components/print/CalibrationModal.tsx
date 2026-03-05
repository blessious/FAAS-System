import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Save, RotateCcw, Loader2, Gauge } from "lucide-react";
import { printAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

interface MappingItem {
    x: number;
    y: number;
    label: string;
}

interface CalibrationMapping {
    [key: string]: MappingItem;
}

interface CalibrationModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCalibrated: () => void;
    recordId?: string | number;
}

export function CalibrationModal({ open, onOpenChange, onCalibrated, recordId }: CalibrationModalProps) {
    const { toast } = useToast();
    const [mapping, setMapping] = useState<CalibrationMapping | null>(null);
    const [selectedField, setSelectedField] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [step, setStep] = useState<number>(0.1); // Precision step in cm

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

    const handleReset = () => {
        fetchMapping();
    };

    if (!mapping) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] rounded-2xl border-0 shadow-2xl p-0 overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                            <Gauge className="w-6 h-6" />
                            Precision Calibration
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-emerald-50/80 text-xs mt-2 italic">Record-Specific Alignment</p>
                </div>

                <div className="grid gap-6 p-6">
                    <div className="space-y-2">
                        <Label htmlFor="field-select" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Select Field to Adjust</Label>
                        <Select value={selectedField} onValueChange={setSelectedField}>
                            <SelectTrigger id="field-select" className="border-slate-200 bg-slate-50/50 h-10">
                                <SelectValue placeholder="Choose a field" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[400px]">
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
                                            <div key={groupName}>
                                                <div className="px-2 py-1.5 text-[10px] font-black text-emerald-600 bg-emerald-50/50 uppercase tracking-widest sticky top-0 z-10">
                                                    {groupName}
                                                </div>
                                                {items.map(([key, item]) => (
                                                    <SelectItem key={key} value={key} className="pl-4">
                                                        {item.label || key}
                                                    </SelectItem>
                                                ))}
                                            </div>
                                        )
                                    ));
                                })()}
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedField && (
                        <div className="flex flex-col items-center gap-6 p-6 bg-slate-50/50 rounded-2xl border border-slate-100 shadow-inner">
                            <div className="text-center space-y-1 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CM COORDINATES</div>
                                <div className="text-2xl font-black text-emerald-600 font-mono flex items-center gap-3">
                                    <span className="text-slate-300">X:</span> {mapping[selectedField].x.toFixed(2)}
                                    <span className="text-slate-200">/</span>
                                    <span className="text-slate-300">Y:</span> {mapping[selectedField].y.toFixed(2)}
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3 relative">
                                <div />
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-14 w-14 rounded-2xl shadow-lg border-emerald-100 bg-white hover:bg-emerald-500 hover:text-white transition-all active:scale-95"
                                    onClick={() => handleMove('up')}
                                >
                                    <ArrowUp className="w-8 h-8" />
                                </Button>
                                <div />

                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-14 w-14 rounded-2xl shadow-lg border-emerald-100 bg-white hover:bg-emerald-500 hover:text-white transition-all active:scale-95"
                                    onClick={() => handleMove('left')}
                                >
                                    <ArrowLeft className="w-8 h-8" />
                                </Button>
                                <div className="flex items-center justify-center">
                                    <div className="w-4 h-4 bg-emerald-100 rounded-full flex items-center justify-center">
                                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-14 w-14 rounded-2xl shadow-lg border-emerald-100 bg-white hover:bg-emerald-500 hover:text-white transition-all active:scale-95"
                                    onClick={() => handleMove('right')}
                                >
                                    <ArrowRight className="w-8 h-8" />
                                </Button>

                                <div />
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-14 w-14 rounded-2xl shadow-lg border-emerald-100 bg-white hover:bg-emerald-500 hover:text-white transition-all active:scale-95"
                                    onClick={() => handleMove('down')}
                                >
                                    <ArrowDown className="w-8 h-8" />
                                </Button>
                                <div />
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between px-2 bg-slate-100/50 p-2 rounded-lg border border-dashed border-slate-200">
                        <Label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Step Sensitivity</Label>
                        <div className="flex gap-1">
                            {[0.05, 0.1, 0.5, 1.0].map((s) => (
                                <Button
                                    key={s}
                                    variant={step === s ? "default" : "ghost"}
                                    size="sm"
                                    className={cn(
                                        "h-7 px-2 text-[10px] font-bold rounded-md transition-all",
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

                <DialogFooter className="gap-3 p-6 bg-slate-50 border-t border-slate-100">
                    <Button variant="ghost" onClick={handleReset} className="gap-2 text-slate-400 hover:text-slate-600 font-bold text-xs uppercase tracking-widest">
                        <RotateCcw className="w-3 h-3" />
                        Reset
                    </Button>
                    <div className="flex-1" />
                    <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 gap-2 px-6 shadow-lg shadow-emerald-500/20 font-bold uppercase tracking-widest text-xs h-10">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Calibration
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(" ");
}
