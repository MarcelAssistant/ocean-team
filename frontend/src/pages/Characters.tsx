import { useState, useEffect, useRef } from "react";
import { api } from "../api";
import { Card, Btn, Input, Label } from "../components/ui";

export default function Characters() {
  const [characters, setCharacters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [styleFilter, setStyleFilter] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", style: "hyper_realistic", appearance: "", attitude: "", role: "", notes: "" });
  const [inspirationFile, setInspirationFile] = useState<File | null>(null);
  const [generatingFromImage, setGeneratingFromImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [outfitForm, setOutfitForm] = useState({ name: "", description: "" });
  const [addingOutfit, setAddingOutfit] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    const params = styleFilter ? { style: styleFilter } : undefined;
    api.getCharacters(params).then((r) => { setCharacters(r.characters); setLoading(false); }).catch(() => setLoading(false));
  };
  useEffect(() => { load(); }, [styleFilter]);

  const generateFromImage = async () => {
    if (!inspirationFile) return;
    setGeneratingFromImage(true);
    try {
      const r = await api.describeCharacterFromImage(inspirationFile, form.style);
      setForm((f) => ({ ...f, appearance: r.appearance || f.appearance, attitude: r.attitude || f.attitude, role: r.role || f.role }));
    } catch (e: any) { alert(e.message); } finally { setGeneratingFromImage(false); }
  };

  const createCharacter = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await api.createCharacter(form, inspirationFile || undefined);
      setForm({ name: "", style: "hyper_realistic", appearance: "", attitude: "", role: "", notes: "" });
      setInspirationFile(null);
      setShowForm(false);
      load();
    } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  };

  const addOutfit = async (characterId: string) => {
    if (!outfitForm.name.trim()) return;
    setSaving(true);
    try {
      await api.createOutfit(characterId, outfitForm);
      setOutfitForm({ name: "", description: "" });
      setAddingOutfit(null);
      load();
    } catch (e: any) { alert(e.message); } finally { setSaving(false); }
  };

  const selected = characters.find((c) => c.id === selectedId);

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Video characters & outfits</span>
          <select
            value={styleFilter}
            onChange={(e) => setStyleFilter(e.target.value)}
            className="rounded-md border px-2 py-1 text-xs"
            style={{ background: "var(--bg-input)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          >
            <option value="">All styles</option>
            <option value="hyper_realistic">Hyper realistic</option>
            <option value="manga_realistic">Manga realistic</option>
          </select>
        </div>
        <Btn variant="primary" onClick={() => setShowForm(true)}>+ Character</Btn>
      </div>

      {showForm && (
        <Card className="mb-5" style={{ borderColor: "var(--accent)" }}>
          <h3 className="text-sm font-medium mb-3" style={{ color: "var(--text-primary)" }}>New character</h3>
          <div className="space-y-3 mb-3">
            <div>
              <Label>Inspiration image (drawing, photo, concept art)</Label>
              <div className="flex gap-2 items-center mt-1">
                <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={(e) => setInspirationFile(e.target.files?.[0] || null)} />
                <Btn variant="ghost" onClick={() => fileInputRef.current?.click()}>{inspirationFile ? inspirationFile.name : "Choose image"}</Btn>
                {inspirationFile && (
                  <Btn variant="ghost" onClick={generateFromImage} disabled={generatingFromImage}>{generatingFromImage ? "..." : "Generate outline from image"}</Btn>
                )}
              </div>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>Attach a reference, then click Generate to get a style-specific outline (hyper realistic or manga realistic).</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Character name" /></div>
            <div>
              <Label>Style</Label>
              <select value={form.style} onChange={(e) => setForm({ ...form, style: e.target.value })} className="w-full rounded-md border px-3 py-2 text-sm" style={{ background: "var(--bg-input)", borderColor: "var(--border)", color: "var(--text-primary)" }}>
                <option value="hyper_realistic">Hyper realistic</option>
                <option value="manga_realistic">Manga realistic</option>
              </select>
            </div>
            <div className="md:col-span-2"><Label>Look (appearance)</Label><Input value={form.appearance} onChange={(e) => setForm({ ...form, appearance: e.target.value })} placeholder="Face, physique, distinctive features" /></div>
            <div><Label>Attitude</Label><Input value={form.attitude} onChange={(e) => setForm({ ...form, attitude: e.target.value })} placeholder="Personality, tone" /></div>
            <div><Label>Role</Label><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="e.g. hero, mentor" /></div>
            <div className="md:col-span-2"><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Extra details, inspiration" /></div>
          </div>
          <div className="flex gap-2 mt-3"><Btn variant="primary" onClick={createCharacter} disabled={saving || !form.name.trim()}>{saving ? "..." : "Create"}</Btn><Btn onClick={() => setShowForm(false)}>Cancel</Btn></div>
        </Card>
      )}

      {loading && <p className="text-xs" style={{ color: "var(--text-muted)" }}>Loading...</p>}
      {!loading && characters.length === 0 && (
        <Card>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No characters yet. Create one above or ask the Character & World Agent in chat to create a character (look, attitude, role). They’re stored here and can be reused for consistent video generation.</p>
        </Card>
      )}

      {!loading && characters.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {characters.map((c) => (
            <Card key={c.id} className="overflow-hidden">
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Character visual — reference image or avatar placeholder */}
                <div className="shrink-0 flex justify-center sm:justify-start">
                  {c.referenceImagePath ? (
                    <img
                      src={`/api/files/${c.referenceImagePath}`}
                      alt={c.name}
                      className="w-32 h-32 object-cover rounded-xl border-2"
                      style={{ borderColor: c.style === "manga_realistic" ? "#a78bfa" : "#60a5fa" }}
                    />
                  ) : (
                    <div
                      className="w-32 h-32 rounded-xl flex items-center justify-center text-4xl font-bold"
                      style={{
                        background: c.style === "manga_realistic" ? "linear-gradient(135deg, #a78bfa22 0%, #ec489922 100%)" : "linear-gradient(135deg, #60a5fa22 0%, #34d39922 100%)",
                        border: `2px solid ${c.style === "manga_realistic" ? "#a78bfa44" : "#60a5fa44"}`,
                        color: c.style === "manga_realistic" ? "#a78bfa" : "#60a5fa",
                      }}
                    >
                      {(c.name || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <button onClick={() => setSelectedId(selectedId === c.id ? null : c.id)} className="text-sm font-medium hover:underline" style={{ color: "var(--accent)" }}>{c.name}</button>
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}>{c.style}</span>
                  </div>
                  {c.appearance && <p className="text-xs mb-0.5" style={{ color: "var(--text-secondary)" }}><strong>Look:</strong> {c.appearance}</p>}
                  {c.attitude && <p className="text-xs mb-0.5" style={{ color: "var(--text-secondary)" }}><strong>Attitude:</strong> {c.attitude}</p>}
                  {c.role && <p className="text-xs" style={{ color: "var(--text-secondary)" }}><strong>Role:</strong> {c.role}</p>}
                  {c.outfits?.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[10px] font-medium mb-1" style={{ color: "var(--text-muted)" }}>Outfits</p>
                      <div className="flex flex-wrap gap-1">
                        {c.outfits.map((o: any) => (
                          <span key={o.id} className="text-[10px] px-1.5 py-0.5 rounded border" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>{o.name}{o.description ? `: ${o.description.slice(0, 40)}${o.description.length > 40 ? "…" : ""}` : ""}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedId === c.id && (
                    <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                      {addingOutfit === c.id ? (
                        <div className="flex flex-wrap gap-2 items-end">
                          <div><Label>Outfit name</Label><Input value={outfitForm.name} onChange={(e) => setOutfitForm({ ...outfitForm, name: e.target.value })} placeholder="e.g. Casual" /></div>
                          <div><Label>Description</Label><Input value={outfitForm.description} onChange={(e) => setOutfitForm({ ...outfitForm, description: e.target.value })} placeholder="Clothes, colors" /></div>
                          <Btn variant="primary" onClick={() => addOutfit(c.id)} disabled={saving || !outfitForm.name.trim()}>{saving ? "..." : "Add"}</Btn>
                          <Btn onClick={() => { setAddingOutfit(null); setOutfitForm({ name: "", description: "" }); }}>Cancel</Btn>
                        </div>
                      ) : (
                        <Btn variant="ghost" onClick={() => setAddingOutfit(c.id)}>+ Add outfit</Btn>
                      )}
                      <p className="text-[10px] mt-2" style={{ color: "var(--text-muted)" }}>Use character ID <code className="px-1 rounded" style={{ background: "var(--bg-input)" }}>{c.id}</code> and outfit IDs in video plans for consistent look.</p>
                    </div>
                  )}
                </div>
                <Btn variant="ghost" onClick={() => setSelectedId(selectedId === c.id ? null : c.id)} className="shrink-0">{selectedId === c.id ? "Less" : "More"}</Btn>
              </div>
              {/* Visual summary bar */}
              <div className="mt-2 pt-2 border-t flex flex-wrap gap-1" style={{ borderColor: "var(--border)" }}>
                <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: c.style === "manga_realistic" ? "#a78bfa22" : "#60a5fa22", color: c.style === "manga_realistic" ? "#a78bfa" : "#60a5fa" }}>
                  {c.style === "manga_realistic" ? "Manga" : "Hyper-realistic"}
                </span>
                {c.outfits?.length > 0 && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--bg-input)", color: "var(--text-muted)" }}>{c.outfits.length} outfit{c.outfits.length !== 1 ? "s" : ""}</span>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
