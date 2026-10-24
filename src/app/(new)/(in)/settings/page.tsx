import type { Metadata } from "next";
import { SettingsScreen } from "@/new/screens/you";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return <SettingsScreen />;
}
