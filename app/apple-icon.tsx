import { ImageResponse } from "next/og";
import { AppIcon } from "@/components/app-icon";

export const size = {
  height: 180,
  width: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<AppIcon size={size.width} />, size);
}
