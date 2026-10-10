import { RevealMoment } from "@/components/reveal/reveal-moment";

// The reveal, played one beat at a time. Full screen, no shell: AuthGate's FULLSCREEN_ROUTES.
export default async function RevealPage({ params }: PageProps<"/reveal/[through]">) {
  const { through } = await params;
  return <RevealMoment through={parseInt(through, 10)} />;
}
