import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CheckCircle2, Copy, FileOutput, Loader2, Printer, Save, Settings2, SlidersHorizontal } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { printAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext.jsx";
import { CalibrationModal } from "@/components/print/CalibrationModal";

type Adjustment = { pageNumber: number; offsetXmm: number; offsetYmm: number; scaleX: number; scaleY: number; rotationDeg: number };
type FieldOverride = { fieldKey: string; label?: string; pageNumber?: number; deltaXmm: number; deltaYmm: number; fontDeltaPt: number };
type Profile = any;

const blankAdjustment = (pageNumber: number): Adjustment => ({ pageNumber, offsetXmm: 0, offsetYmm: 0, scaleX: 1, scaleY: 1, rotationDeg: 0 });
const apiOrigin = () => import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:3001`;

export function TdcCalibrationWizard({ open, onOpenChange, onProfileSelected }: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onProfileSelected: (profileId?: string | number) => void;
}) {
  const { toast } = useToast();
  const { isAdmin, user } = useAuth() as any;
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [step, setStep] = useState<'profiles' | 'settings' | 'page1' | 'page2' | 'verify'>('profiles');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [nudge, setNudge] = useState(0.25);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([blankAdjustment(1), blankAdjustment(2)]);
  const [fields, setFields] = useState<FieldOverride[]>([]);
  const [selectedField, setSelectedField] = useState('');
  const [newProfile, setNewProfile] = useState({ name: '', printerName: '', paperBatch: '' });
  const [showMasterBaseline, setShowMasterBaseline] = useState(false);

  const canEdit = Boolean(profile && (profile.is_owner || Number(profile.owner_user_id) === Number(user?.id) || isAdmin) && (profile.visibility !== 'published' || isAdmin));
  const selectedOverride = fields.find(field => field.fieldKey === selectedField);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const result = await printAPI.listTdcProfiles();
      setProfiles(result);
    } catch (error: any) {
      toast({ title: 'Unable to load TDC profiles', description: error.error || 'Try again.', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const selectProfile = async (id: string | number, moveToSettings = true) => {
    try {
      setLoading(true);
      const detail = await printAPI.getTdcProfile(id);
      setProfile(detail);
      setAdjustments(detail.adjustments?.length ? detail.adjustments : [blankAdjustment(1), blankAdjustment(2)]);
      const mappedFields = await printAPI.getTdcProfileFields(id);
      setFields(mappedFields);
      setSelectedField(mappedFields[0]?.fieldKey || '');
      onProfileSelected(id);
      if (moveToSettings) setStep('settings');
    } catch (error: any) {
      toast({ title: 'Unable to open profile', description: error.error || 'Try again.', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!open) return;
    setStep('profiles');
    setAcknowledged(false);
    loadProfiles();
  }, [open]);

  const createProfile = async () => {
    if (!newProfile.name.trim() || !newProfile.printerName.trim() || !newProfile.paperBatch.trim()) {
      toast({ title: 'Complete the profile details', description: 'Name, printer, and paper batch are all required.', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      const created = await printAPI.createTdcProfile({ ...newProfile, makeDefault: true });
      setProfiles(current => [created, ...current]);
      await selectProfile(created.id);
    } catch (error: any) {
      toast({ title: 'Profile was not created', description: error.error || 'Try again.', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const move = (page: number, axis: 'x' | 'y', direction: 1 | -1) => {
    setAdjustments(current => current.map(item => item.pageNumber === page
      ? { ...item, [axis === 'x' ? 'offsetXmm' : 'offsetYmm']: Number(((axis === 'x' ? item.offsetXmm : item.offsetYmm) + (direction * nudge)).toFixed(2)) }
      : item));
  };

  const setAdjustment = (page: number, key: keyof Adjustment, value: number) => {
    setAdjustments(current => current.map(item => item.pageNumber === page ? { ...item, [key]: value } : item));
  };

  const copyPageOne = () => setAdjustments(current => {
    const one = current.find(item => item.pageNumber === 1) || blankAdjustment(1);
    return current.map(item => item.pageNumber === 2 ? { ...one, pageNumber: 2 } : item);
  });

  const updateField = (key: keyof FieldOverride, delta: number) => setFields(current => current.map(field => field.fieldKey === selectedField
    ? { ...field, [key]: Number(((field[key] as number) + delta).toFixed(2)) }
    : field));

  const printTest = async () => {
    if (!profile) return;
    try {
      setSaving(true);
      const response = await printAPI.generateTdcCalibrationTest(profile.id, adjustments);
      window.open(`${apiOrigin()}${response.data.pdfUrl}`, '_blank', 'noopener');
      toast({ title: 'Alignment test ready', description: 'Print at Actual Size / 100% on a sacrificial TDC form.' });
    } catch (error: any) {
      toast({ title: 'Test generation failed', description: error.error || 'Try again.', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const saveAndVerify = async () => {
    if (!profile || !canEdit) return;
    try {
      setSaving(true);
      await printAPI.updateTdcAdjustments(profile.id, adjustments);
      await printAPI.updateTdcOverrides(profile.id, fields.filter(field => field.deltaXmm || field.deltaYmm || field.fontDeltaPt));
      const updated = await printAPI.updateTdcProfile(profile.id, { isVerified: true });
      setProfile(updated);
      await printAPI.setDefaultTdcProfile(profile.id);
      onProfileSelected(profile.id);
      toast({ title: 'Calibration profile saved', description: 'This profile is now your default TDC alignment.' });
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: 'Calibration was not saved', description: error.error || 'Try again.', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const pagePanel = (page: number) => {
    const adjustment = adjustments.find(item => item.pageNumber === page) || blankAdjustment(page);
    return <div className="space-y-4">
      <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-xs text-emerald-900">
        <strong>Start with Move all values.</strong> Use scale only when one edge is correct but the opposite edge is not. Use rotation only when the page is diagonal.
      </div>
      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="rounded-lg border bg-white p-2"><p className="text-[10px] font-bold uppercase text-slate-400">Horizontal</p><p className="font-mono font-bold text-emerald-700">{adjustment.offsetXmm.toFixed(2)} mm</p></div>
        <div className="rounded-lg border bg-white p-2"><p className="text-[10px] font-bold uppercase text-slate-400">Vertical</p><p className="font-mono font-bold text-emerald-700">{adjustment.offsetYmm.toFixed(2)} mm</p></div>
      </div>
      <div className="mx-auto grid w-44 grid-cols-3 gap-2">
        <span />
        <Button variant="outline" size="icon" onClick={() => move(page, 'y', 1)} disabled={!canEdit}><ArrowUp /></Button>
        <span />
        <Button variant="outline" size="icon" onClick={() => move(page, 'x', -1)} disabled={!canEdit}><ArrowLeft /></Button>
        <span className="flex items-center justify-center text-[10px] font-bold text-slate-400">{nudge} mm</span>
        <Button variant="outline" size="icon" onClick={() => move(page, 'x', 1)} disabled={!canEdit}><ArrowRight /></Button>
        <span />
        <Button variant="outline" size="icon" onClick={() => move(page, 'y', -1)} disabled={!canEdit}><ArrowDown /></Button>
      </div>
      <div className="flex justify-center gap-2">{[0.1, 0.25, 1].map(value => <Button key={value} size="sm" variant={nudge === value ? 'default' : 'outline'} onClick={() => setNudge(value)}>{value} mm</Button>)}</div>
      <div className="grid grid-cols-3 gap-3">
        {[
          ['scaleX', 'Horizontal scale', adjustment.scaleX], ['scaleY', 'Vertical scale', adjustment.scaleY], ['rotationDeg', 'Rotation °', adjustment.rotationDeg],
        ].map(([key, label, value]) => <label key={String(key)} className="space-y-1 text-xs font-medium text-slate-600"><span>{label}</span><Input disabled={!canEdit} type="number" step={key === 'rotationDeg' ? '0.05' : '0.001'} value={Number(value)} onChange={event => setAdjustment(page, key as keyof Adjustment, Number(event.target.value))} /></label>)}
      </div>
      <details className="rounded-lg border border-slate-200 bg-white p-3">
        <summary className="cursor-pointer text-xs font-bold text-slate-700">Advanced: one-field exception</summary>
        <p className="mt-2 text-[11px] text-slate-500">Use only after page alignment is confirmed. These changes are stored as small offsets, never as copied record values.</p>
        <select className="mt-2 h-9 w-full rounded-md border border-slate-200 px-2 text-xs" value={selectedField} onChange={event => setSelectedField(event.target.value)} disabled={!canEdit}>
          {fields.filter(field => field.pageNumber === page).map(field => <option key={field.fieldKey} value={field.fieldKey}>{field.label}</option>)}
        </select>
        {selectedOverride && <div className="mt-2 flex flex-wrap items-center gap-2 text-xs"><span className="font-mono text-slate-500">ΔX {selectedOverride.deltaXmm.toFixed(2)} / ΔY {selectedOverride.deltaYmm.toFixed(2)} mm</span><Button size="sm" variant="outline" onClick={() => updateField('deltaXmm', -nudge)}>←</Button><Button size="sm" variant="outline" onClick={() => updateField('deltaXmm', nudge)}>→</Button><Button size="sm" variant="outline" onClick={() => updateField('deltaYmm', nudge)}>↑</Button><Button size="sm" variant="outline" onClick={() => updateField('deltaYmm', -nudge)}>↓</Button></div>}
      </details>
    </div>;
  };

  const chosenProfile = useMemo(() => profiles.find(item => item.id === profile?.id), [profiles, profile]);

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle className="flex items-center gap-2"><SlidersHorizontal className="text-emerald-600" />TDC Pre-printed Form Calibration</DialogTitle><DialogDescription>Profiles are tied to a printer and paper batch. Align the page first; use field exceptions only when necessary.</DialogDescription></DialogHeader>
      {loading ? <div className="flex justify-center py-12"><Loader2 className="animate-spin text-emerald-600" /></div> : <>
        {step === 'profiles' && <div className="space-y-4">
          {profiles.length > 0 && <div className="space-y-2">{profiles.map(item => <button key={item.id} onClick={() => selectProfile(item.id)} className="flex w-full items-center justify-between rounded-xl border p-3 text-left hover:border-emerald-300 hover:bg-emerald-50"><span><b>{item.name}</b><span className="block text-xs text-slate-500">{item.printer_name} · {item.paper_batch} · {item.visibility === 'published' ? 'Office profile' : 'Private'}</span></span><span className="text-xs font-bold text-emerald-700">{item.is_default ? 'DEFAULT' : item.is_verified ? 'VERIFIED' : 'VERIFY'}</span></button>)}</div>}
          <Separator /><div className="space-y-3"><p className="text-sm font-bold">New printer or paper batch</p><div className="grid gap-2 sm:grid-cols-3"><Input placeholder="Profile name" value={newProfile.name} onChange={e => setNewProfile({ ...newProfile, name: e.target.value })} /><Input placeholder="Printer name" value={newProfile.printerName} onChange={e => setNewProfile({ ...newProfile, printerName: e.target.value })} /><Input placeholder="Paper batch label" value={newProfile.paperBatch} onChange={e => setNewProfile({ ...newProfile, paperBatch: e.target.value })} /></div><Button onClick={createProfile} disabled={saving}>{saving && <Loader2 className="mr-2 animate-spin" />}Create and calibrate</Button></div>
          {isAdmin && <Button variant="ghost" size="sm" className="text-xs text-slate-500" onClick={() => setShowMasterBaseline(true)}><Settings2 className="mr-1 size-3" />Edit master coordinate baseline</Button>}
        </div>}
        {profile && step === 'settings' && <div className="space-y-4"><div className="rounded-xl border bg-slate-50 p-4"><b>{chosenProfile?.name || profile.name}</b><p className="mt-1 text-sm text-slate-600">{profile.printer_name} · {profile.paper_batch}</p></div><div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-bold">Before the test print</p><p>Use 8×11 portrait paper, select Actual Size / 100%, do not use Fit to Page, and feed a sacrificial blank TDC into the correct tray.</p><div className="flex items-center gap-2"><Checkbox id="tdc-print-settings" checked={acknowledged} onCheckedChange={value => setAcknowledged(value === true)} /><Label htmlFor="tdc-print-settings">I have checked these print settings.</Label></div></div><Button className="w-full" disabled={!acknowledged} onClick={() => setStep('page1')}>Start Page 1 alignment</Button></div>}
        {profile && step === 'page1' && <div className="space-y-4"><h3 className="font-bold">Page 1: adjust the full page</h3>{pagePanel(1)}<div className="flex justify-between"><Button variant="outline" onClick={() => setStep('settings')}>Back</Button><div className="flex gap-2"><Button variant="outline" onClick={printTest} disabled={saving}><Printer className="mr-2 size-4" />Print test</Button><Button onClick={() => setStep('page2')}>Page 2</Button></div></div></div>}
        {profile && step === 'page2' && <div className="space-y-4"><div className="flex items-center justify-between"><h3 className="font-bold">Page 2: adjust the full page</h3><Button size="sm" variant="outline" onClick={copyPageOne} disabled={!canEdit}><Copy className="mr-1 size-3" />Copy Page 1</Button></div>{pagePanel(2)}<div className="flex justify-between"><Button variant="outline" onClick={() => setStep('page1')}>Back</Button><div className="flex gap-2"><Button variant="outline" onClick={printTest} disabled={saving}><Printer className="mr-2 size-4" />Print test</Button><Button onClick={() => setStep('verify')}>Verify</Button></div></div></div>}
        {profile && step === 'verify' && <div className="space-y-4"><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"><CheckCircle2 className="mb-2 text-emerald-600" /><b>Verify before saving.</b><p className="mt-1">Check the six neutral markers on the actual pre-printed TDC form. They should sit in their intended cells on both pages.</p></div><Button variant="outline" className="w-full" onClick={printTest} disabled={saving}><FileOutput className="mr-2 size-4" />Print another alignment test</Button><div className="flex justify-between"><Button variant="outline" onClick={() => setStep('page2')}>Back</Button><Button onClick={saveAndVerify} disabled={saving || !canEdit}>{saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}Save verified profile</Button></div>{isAdmin && <Button variant="ghost" className="w-full text-xs" onClick={async () => { await printAPI.publishTdcProfile(profile.id, profile.visibility !== 'published'); await selectProfile(profile.id, false); }}>{profile.visibility === 'published' ? 'Make private' : 'Publish as office profile'}</Button>}</div>}
      </>}
      <DialogFooter>{step !== 'profiles' && <Button variant="ghost" onClick={() => setStep('profiles')}>All profiles</Button>}<Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button></DialogFooter>
      {isAdmin && <CalibrationModal open={showMasterBaseline} onOpenChange={setShowMasterBaseline} onCalibrated={() => { loadProfiles(); setShowMasterBaseline(false); }} />}
    </DialogContent>
  </Dialog>;
}
