"use client";
import { AREAS } from "@/lib/areas";
import type { Profile } from "@/lib/supabase";
import { useLang, type Key } from "@/lib/i18n";

// saved in English, shown in the chosen language
const GENDERS = ["Female", "Male", "Other", "Prefer not to say"];

// Name, phone, age, gender. Used by sign-up and the profile page; values are read with detailsFrom().
export function PersonalFields({ profile }: { profile?: Profile | null }) {
  const { t } = useLang();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="label sm:col-span-2">
        {t("f.name")} <span className="font-normal text-slate-500">{t("f.nameHint")}</span>
        <input name="name" required defaultValue={profile?.name} className="input" autoComplete="name" />
      </label>
      <label className="label">
        {t("f.phone")}
        <input name="phone" type="tel" required pattern="[0-9 +\-]{10,15}" title={t("f.phoneTitle")} defaultValue={profile?.phone ?? ""} className="input" autoComplete="tel" />
      </label>
      <label className="label">
        {t("f.age")}
        <input name="age" type="number" min="10" max="120" defaultValue={profile?.age ?? ""} className="input" />
      </label>
      <label className="label sm:col-span-2">
        {t("f.gender")}
        <select name="gender" defaultValue={profile?.gender ?? ""} className="input">
          <option value="">{t("f.select")}</option>
          {GENDERS.map((g) => <option key={g} value={g}>{t(`g.${g}` as Key)}</option>)}
        </select>
      </label>
    </div>
  );
}

// One pickup address; values are read with addressFrom()
export function AddressFields() {
  const { t } = useLang();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="label">
        {t("f.label")}
        <input name="label" required placeholder={t("f.labelPh")} defaultValue={t("f.labelDefault")} className="input" />
      </label>
      <label className="label">
        {t("f.area")}
        <select name="area" required className="input">
          {Object.keys(AREAS).map((a) => <option key={a}>{a}</option>)}
        </select>
      </label>
      <label className="label sm:col-span-2">
        {t("f.address")}
        <input name="line" required placeholder={t("f.addressPh")} className="input" autoComplete="street-address" />
      </label>
    </div>
  );
}
