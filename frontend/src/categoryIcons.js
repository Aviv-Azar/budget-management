const CATEGORY_ICONS = {
  "משכורת": "💰",
  "מכולת": "🛒",
  "מסעדות": "🍽️",
  "תחבורה": "🚗",
  "חשבונות": "⚡",
  "שכירות/משכנתא": "🏠",
  "קניות": "🛍️",
  "בריאות": "💊",
  "בידור": "🎬",
  "אחר": "🏷️",
};

export function categoryIcon(name) {
  return CATEGORY_ICONS[name] || "🏷️";
}
