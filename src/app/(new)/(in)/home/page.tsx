import type { Metadata } from "next";
import { HomeScreen } from "@/new/screens/home";

export const metadata: Metadata = { title: "Home" };

export default function HomePage() {
  return <HomeScreen />;
}
