import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Save, RotateCcw, Loader2 } from "lucide-react";
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
}

export function CalibrationModal({ open, onOpenChange, onCalibrated }: CalibrationModalProps) {
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
    }, [open]);

    const fetchMapping = async () => {
        try {
            setLoading(true);
            const data = await printAPI.getCalibration();
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

        // Note: Y decreases as we go "up" the page in ReportLab if origin is top-left, 
        // but ReportLab origin is bottom-left by default. 
        // In our script, Y=11 is top, Y=0 is bottom.
        // So "Up" means Y increases.

        switch (direction) {
            case 'up': current.y = parseFloat((current.y + step).toFixed(2)); break;
            case 'down': current.y = parseFloat((current.y - step).toFixed(2)); break;
            case 'left': current.x = parseFloat((current.x - step).toFixed(2)); break;
            case 'right': current.x = parseFloat((current.x + step).toFixed(2)); break;
        }

        setMapping({
            ...mapping,
            [selectedField]: current
        });
    };

    const handleSave = async () => {
        if (!mapping) return;
        try {
            setSaving(true);
            await printAPI.updateCalibration(mapping);
            toast({
                title: "Calibration Saved",
                description: "Coordinates updated. Regenerating PDF...",
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
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        Precision Calibration
                    </DialogTitle>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="field-select">Select Field to Adjust</Label>
                        <Select value={selectedField} onValueChange={setSelectedField}>
                            <SelectTrigger id="field-select">
                                <SelectValue placeholder="Choose a field" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                                {Object.entries(mapping).map(([key, item]) => (
                                    <SelectItem key={key} value={key}>
                                        {item.label || key}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedField && (
                        <div className="flex flex-col items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-inner">
                            <div className="text-center space-y-1">
                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Current Coordinates (CM)</div>
                                <div className="text-2xl font-black text-emerald-600 font-mono">
                                    X: {mapping[selectedField].x} | Y: {mapping[selectedField].y}
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                <div />
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-12 w-12 rounded-full shadow-md bg-white hover:bg-emerald-50 hover:text-emerald-700"
                                    onClick={() => handleMove('up')}
                                >
                                    <ArrowUp className="w-6 h-6" />
                                </Button>
                                <div />

                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-12 w-12 rounded-full shadow-md bg-white hover:bg-emerald-50 hover:text-emerald-700"
                                    onClick={() => handleMove('left')}
                                >
                                    <ArrowLeft className="w-6 h-6" />
                                </Button>
                                <div className="flex items-center justify-center p-2">
                                    <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-sm shadow-emerald-500/50" />
                                </div>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-12 w-12 rounded-full shadow-md bg-white hover:bg-emerald-50 hover:text-emerald-700"
                                    onClick={() => handleMove('right')}
                                >
                                    <ArrowRight className="w-6 h-6" />
                                </Button>

                                <div />
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-12 w-12 rounded-full shadow-md bg-white hover:bg-emerald-50 hover:text-emerald-700"
                                    onClick={() => handleMove('down')}
                                >
                                    <ArrowDown className="w-6 h-6" />
                                </Button>
                                <div />
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between px-2">
                        <Label className="text-xs text-slate-500">Step Sensitivity</Label>
                        <div className="flex gap-2">
                            {[0.05, 0.1, 0.5, 1.0].map((s) => (
                                <Button
                                    key={s}
                                    variant={step === s ? "default" : "outline"}
                                    size="sm"
                                    className="h-7 w-12 text-[10px] px-0"
                                    onClick={() => setStep(s)}
                                >
                                    {s} cm
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="ghost" onClick={handleReset} className="gap-2 text-slate-500">
                        <RotateCcw className="w-4 h-4" />
                        Reset
                    </Button>
                    <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Apply & Shoot
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
