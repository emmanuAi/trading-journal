import { NextResponse } from "next/server";
import {
  listWeeklyReviews,
  createWeeklyReview,
  deleteWeeklyReview,
  listMonthlyReviews,
  createMonthlyReview,
  deleteMonthlyReview,
} from "@/lib/repository/reviews";

export async function GET() {
  return NextResponse.json({
    weekly: await listWeeklyReviews(),
    monthly: await listMonthlyReviews(),
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  if (body.kind === "weekly") {
    const review = await createWeeklyReview({
      weekStart: body.weekStart,
      wins: body.wins ?? "",
      mistakes: body.mistakes ?? "",
      lessons: body.lessons ?? "",
      goalForNextWeek: body.goalForNextWeek ?? "",
    });
    return NextResponse.json({ review }, { status: 201 });
  }
  if (body.kind === "monthly") {
    const review = await createMonthlyReview({
      monthStart: body.monthStart,
      summary: body.summary ?? "",
      lessons: body.lessons ?? "",
      goalForNextMonth: body.goalForNextMonth ?? "",
    });
    return NextResponse.json({ review }, { status: 201 });
  }
  return NextResponse.json({ error: "kind must be 'weekly' or 'monthly'." }, { status: 400 });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind");
  const id = searchParams.get("id");
  if (!id || (kind !== "weekly" && kind !== "monthly")) {
    return NextResponse.json({ error: "kind and id are required." }, { status: 400 });
  }
  if (kind === "weekly") await deleteWeeklyReview(id);
  else await deleteMonthlyReview(id);
  return NextResponse.json({ ok: true });
}
