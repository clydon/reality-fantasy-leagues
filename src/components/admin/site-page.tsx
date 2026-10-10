"use client";

import { LayoutList } from "lucide-react";
import { AI_MODELS } from "@/lib/ai-cost";
import { usePaidAiStore } from "@/lib/paid-ai-store";
import { Field, ToggleRow, fieldCls } from "@/components/setup/settings-ui";
import { OverviewLayoutsSection } from "@/components/overview/overview-customize-panel";
import { useWhatsNewPreview } from "@/components/whats-new-modal";
import { ActButton, AdminPage, Row, Rows, Section } from "./admin-ui";

// Site settings (docs/PLAN-ux-redesign.md 3a and 1g): the two switches that used to fill a phone's
// first screen of Admin, the AI model choice and its prices (out of the main flow, where they read
// like developer notes), the What's New preview, and the Overview layouts that apply to every league.
// The switches and models are per browser: they're one admin's guard rails, not site state.

export function SitePage() {
  const { showPaid, setShowPaid, showSpoilers, setShowSpoilers, models, setModels } = usePaidAiStore();
  const showWhatsNew = useWhatsNewPreview((s) => s.show);
  return (
    <AdminPage title="Site settings">
      <Section title="Safety">
        <Rows>
          <ToggleRow
            label="Show paid AI actions"
            hint={
              showPaid
                ? "On: buttons that spend money on AI (wiki episode pulls, web research, structuring pasted notes, auto research) are showing, each with its typical cost."
                : "Off: every button that spends money on AI is hidden, except pulling a cast. Reviewing, pasting JSON and settings still work. Auto research that's already on keeps running."
            }
            checked={showPaid}
            onChange={setShowPaid}
          />
          <ToggleRow
            label="Show episode results"
            hint={
              showSpoilers
                ? "On: research and review show who went home, what happened, and tribe and team changes."
                : "Off: review and accept by the count, without names or outcomes. Each episode can still be opened on its own. For an admin who's playing and behind."
            }
            checked={showSpoilers}
            onChange={setShowSpoilers}
          />
        </Rows>
        <p className="text-[13px] leading-snug text-muted-foreground">Both are remembered in this browser.</p>
      </Section>

      <Section title="AI models">
        <div className="flex flex-col gap-5">
          <Field label="Reading the wiki" htmlFor="model-wiki" hint="Pulls a season's cast and results from its wiki page.">
            <select id="model-wiki" className={fieldCls} value={models.wiki} onChange={(e) => setModels({ ...models, wiki: e.target.value })}>
              {AI_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} · ${m.input} in, ${m.output} out per million tokens
                </option>
              ))}
            </select>
          </Field>
          <Field label="Researching episodes" htmlFor="model-research" hint="Web research by hand. Auto research has its own choice on each season. Searches cost 1¢ each on top.">
            <select id="model-research" className={fieldCls} value={models.research} onChange={(e) => setModels({ ...models, research: e.target.value })}>
              {AI_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} · ${m.input} in, ${m.output} out per million tokens
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Section>

      <Section title="What's New">
        <div className="flex flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 text-[15px] leading-snug text-muted-foreground">The one-time popup players see after an update. Previewing doesn&rsquo;t mark it seen.</p>
          <ActButton onClick={showWhatsNew}>Preview</ActButton>
        </div>
      </Section>

      <Section title="Overview layouts">
        <OverviewLayoutsSection />
      </Section>

      <Rows>
        <Row icon={LayoutList} href="/admin/reports" title="Reports" detail="Issues and ideas people have sent" />
      </Rows>
    </AdminPage>
  );
}
