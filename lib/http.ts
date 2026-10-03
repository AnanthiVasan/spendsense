import { NextResponse } from "next/server";

export function notImplemented(feature: string) {
  return NextResponse.json(
    {
      error: "not_implemented",
      feature,
      message: `${feature} is stubbed in Step 1 and will be implemented later.`,
    },
    { status: 501 },
  );
}
