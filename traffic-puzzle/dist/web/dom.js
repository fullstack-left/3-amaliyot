/**
 * Minimal DOM builder. Text is always inserted as text nodes (never innerHTML),
 * so user-provided strings (editor, cloud settings) cannot inject markup.
 */
export function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
        for (const [k, v] of Object.entries(attrs)) {
            if (v === null || v === undefined || v === false)
                continue;
            if (k === 'class')
                el.className = String(v);
            else if (k === 'style' && typeof v === 'object')
                Object.assign(el.style, v);
            else if (k.startsWith('on') && typeof v === 'function')
                el.addEventListener(k.slice(2).toLowerCase(), v);
            else if (k === 'dataset' && typeof v === 'object')
                Object.assign(el.dataset, v);
            else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') {
                el[k] = v;
            }
            else
                el.setAttribute(k, v === true ? '' : String(v));
        }
    }
    append(el, children);
    return el;
}
export function append(el, children) {
    for (const c of children.flat()) {
        if (c === null || c === undefined || c === false)
            continue;
        el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    }
}
export function clear(el) {
    while (el.firstChild)
        el.removeChild(el.firstChild);
}
export function fmtTime(ms) {
    const s = Math.max(0, Math.round(ms / 100) / 10);
    const m = Math.floor(s / 60);
    const r = s - m * 60;
    return m > 0 ? `${m}:${r.toFixed(1).padStart(4, '0')}` : `${r.toFixed(1)} s`;
}
//# sourceMappingURL=dom.js.map