import React, { useEffect } from "react";
import { useRouter } from "expo-router";
import NinSlipScreen from "../services/nin-slip";

export default function SlipsTab() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/services/nin-slip" as any);
  }, []);

  return <NinSlipScreen />;
}
