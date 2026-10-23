export async function onRequestPost({ request }) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  };

  try {
    const body = await request.json();
    const videoUrl = String(body.url || "").trim();

    if (!videoUrl || videoUrl.length > 2048) {
      return Response.json(
        { ok: false, error: "প্রথমে TikTok ভিডিওর লিংক দিন।" },
        { status: 400, headers }
      );
    }

    let input;
    try {
      input = new URL(videoUrl);
    } catch {
      return Response.json(
        { ok: false, error: "সঠিক ভিডিও লিংক দিন।" },
        { status: 400, headers }
      );
    }

    if (
      input.protocol !== "https:" ||
      !(input.hostname === "tiktok.com" ||
        input.hostname.endsWith(".tiktok.com"))
    ) {
      return Response.json(
        { ok: false, error: "এটি অনুমোদিত TikTok HTTPS লিংক নয়।" },
        { status: 400, headers }
      );
    }

    const api = new URL("https://tdownv4.sl-bjs.workers.dev/");
    api.searchParams.set("down", videoUrl);

    const upstream = await fetch(api.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(20000)
    });

    const raw = await upstream.text();

    if (!upstream.ok) {
      return Response.json({
        ok: false,
        error: "তৃতীয় পক্ষের API HTTP " + upstream.status + " দিয়েছে।",
        detail: raw.slice(0, 500)
      }, { status: 502, headers });
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return Response.json({
        ok: false,
        error: "API JSON দেয়নি।",
        detail: raw.slice(0, 500)
      }, { status: 502, headers });
    }

    const link =
      data.download_url ||
      data.data?.download_url ||
      data.data?.play ||
      data.play;

    if (!link) {
      return Response.json({
        ok: false,
        error: "API-এর উত্তরে download_url পাওয়া যায়নি।",
        detail: JSON.stringify(data).slice(0, 700)
      }, { status: 502, headers });
    }

    let media;
    try {
      media = new URL(link);
    } catch {
      return Response.json({
        ok: false,
        error: "API ভুল ডাউনলোড লিংক দিয়েছে।"
      }, { status: 502, headers });
    }

    if (media.protocol !== "https:") {
      return Response.json({
        ok: false,
        error: "API নিরাপদ HTTPS ডাউনলোড লিংক দেয়নি।"
      }, { status: 502, headers });
    }

    return Response.json({
      ok: true,
      title: data.title || "TikTok ভিডিও",
      downloadUrl: media.href
    }, { headers });

  } catch (error) {
    return Response.json({
      ok: false,
      error: error.name === "TimeoutError"
        ? "API-তে সময় শেষ হয়ে গেছে।"
        : "সার্ভার অনুরোধ সম্পন্ন করতে পারেনি।",
      detail: String(error.message || error).slice(0, 300)
    }, { status: 502, headers });
  }
}
