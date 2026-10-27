/** Keep projected labels legible when the city is viewed in a narrow viewport. */
export function placeMapLabels(labels, positions, width, height) {
  const items = Object.keys(positions).map(key => ({
    key, x: positions[key][0], y: positions[key][1],
    w: labels[key].offsetWidth, h: labels[key].offsetHeight,
  }));
  const clamp = item => {
    item.x = Math.max(item.w / 2 + 8, Math.min(width - item.w / 2 - 8, item.x));
    item.y = Math.max(item.h + 14, Math.min(height - 20, item.y));
  };
  items.forEach(clamp);
  for (let pass = 0; pass < 5; pass++) {
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      const overlapX = (a.w + b.w) / 2 + 7 - Math.abs(a.x - b.x);
      const overlapY = (a.h + b.h) / 2 + 6 - Math.abs((a.y - a.h / 2) - (b.y - b.h / 2));
      if (overlapX <= 0 || overlapY <= 0) continue;
      const sign = a.x <= b.x ? 1 : -1;
      a.x -= sign * (overlapX / 2 + 1); b.x += sign * (overlapX / 2 + 1);
      clamp(a); clamp(b);
      if (pass === 4 && Math.abs(a.x - b.x) < (a.w + b.w) / 2 + 5) {
        if (a.y <= b.y) a.y -= overlapY + 1; else b.y -= overlapY + 1;
        clamp(a); clamp(b);
      }
    }
  }
  for (const item of items) {
    labels[item.key].style.left = item.x + 'px';
    labels[item.key].style.top = item.y + 'px';
  }
}
