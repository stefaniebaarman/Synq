/** @jest-environment node */

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildOgImageTags(ogImage) {
  return ogImage
    ? `<meta property="og:image" content="${escapeHtml(ogImage)}" />
    <meta property="og:image:width" content="320" />
    <meta property="og:image:height" content="380" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${escapeHtml(ogImage)}" />`
    : `<meta name="twitter:card" content="summary" />`;
}

describe("profile share OG tags", () => {
  test("escapes unsafe characters in image URLs", () => {
    const unsafe = 'https://example.com/a?b=1&c="2"';
    const tags = buildOgImageTags(unsafe);
    expect(tags).toContain("&amp;");
    expect(tags).toContain("&quot;");
    expect(tags).not.toContain('content="https://example.com/a?b=1&c="');
  });

  test("includes image dimensions and twitter large card when image present", () => {
    const tags = buildOgImageTags("https://storage.example/card.png");
    expect(tags).toContain('property="og:image:width" content="320"');
    expect(tags).toContain('property="og:image:height" content="380"');
    expect(tags).toContain('name="twitter:card" content="summary_large_image"');
    expect(tags).toContain('name="twitter:image"');
  });

  test("falls back to summary twitter card without image", () => {
    const tags = buildOgImageTags("");
    expect(tags).toContain('name="twitter:card" content="summary"');
    expect(tags).not.toContain("og:image");
  });
});
