import HomeClient from "./home-client";

/**
 * BONDED-LEADER home — server shell rendering the live client views.
 * All data arrives at runtime from /api/* (Neon). No static demo content.
 */
export default function Home() {
  return <HomeClient />;
}
