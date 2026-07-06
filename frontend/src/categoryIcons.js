const CATEGORY_ICONS = {
  Salary: "💰",
  Groceries: "🛒",
  "Dining Out": "🍽️",
  Transport: "🚗",
  Utilities: "⚡",
  "Rent/Mortgage": "🏠",
  Shopping: "🛍️",
  Health: "💊",
  Entertainment: "🎬",
  Other: "🏷️",
};

export function categoryIcon(name) {
  return CATEGORY_ICONS[name] || "🏷️";
}
