import { type NextRequest, NextResponse } from "next/server";

const GIPHY_API_KEY = process.env.GIPHY_API_KEY;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const limit = searchParams.get("limit") || "12";

  if (!query) {
    return NextResponse.json(
      { error: "Missing query parameter" },
      { status: 400 }
    );
  }

  if (!GIPHY_API_KEY) {
    // Return fallback memes if no API key
    return NextResponse.json({
      data: [],
      message: "Giphy API key not configured",
    });
  }

  try {
    const response = await fetch(
      `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(
        query
      )}&limit=${limit}&rating=pg-13&lang=en`,
      { next: { revalidate: 300 } } // Cache for 5 minutes
    );

    if (!response.ok) {
      throw new Error("Giphy API error");
    }

    const data = await response.json();

    // Transform to simpler format
    const gifs = data.data.map((gif: any) => ({
      id: gif.id,
      title: gif.title,
      url: gif.images.fixed_height.url,
      preview: gif.images.fixed_height_small.url,
      width: gif.images.fixed_height.width,
      height: gif.images.fixed_height.height,
    }));

    return NextResponse.json({ data: gifs });
  } catch (error) {
    console.error("Giphy API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch GIFs", data: [] },
      { status: 500 }
    );
  }
}
