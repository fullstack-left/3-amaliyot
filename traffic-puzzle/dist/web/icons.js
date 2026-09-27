/**
 * Inline SVG icon set — the HUD never depends on emoji fonts being installed
 * (hearts, stars, controls render identically on every device).
 */
const P = {
    play: 'M8 5v14l11-7z',
    pause: 'M6 5h4v14H6zM14 5h4v14h-4z',
    restart: 'M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z',
    bulb: 'M9 21h6v-1.6H9zM12 2a7 7 0 0 0-4 12.7V18h8v-3.3A7 7 0 0 0 12 2z',
    heart: 'M12 21s-7.5-4.6-9.6-9.1C.9 8.6 3 5 6.5 5c2 0 3.6 1.1 5.5 3.2C13.9 6.1 15.5 5 17.5 5 21 5 23.1 8.6 21.6 11.9 19.5 16.4 12 21 12 21z',
    star: 'M12 2.5l2.9 6.2 6.8.8-5 4.6 1.3 6.7L12 17.6 6 20.8l1.3-6.7-5-4.6 6.8-.8z',
    coin: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 3a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm-1 2v8h2V8z',
    clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm-1 3v6l5 3 1-1.7-4-2.3V7z',
    car: 'M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11h1a1 1 0 0 1 1 1v5h-2v2h-3v-2H8v2H5v-2H3v-5a1 1 0 0 1 1-1zm2.2 0h9.6l-1-3.2H8.2zM6.5 15a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6zm11 0a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6z',
    lock: 'M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z',
    back: 'M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z',
    next: 'M4 11h12.2l-5.6-5.6L12 4l8 8-8 8-1.4-1.4 5.6-5.6H4z',
    map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zm0 2.2 6 2v11.6l-6-2z',
    wrench: 'M21 7.5a5.5 5.5 0 0 1-7.4 5.2l-7.3 7.3a2 2 0 1 1-2.8-2.8l7.3-7.3A5.5 5.5 0 0 1 17.5 2.4l-3.2 3.2 1.1 3 3 1.1z',
    book: 'M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zm2 13a1 1 0 0 0 1 1h8V7a1 1 0 0 0-1-1H7z',
    gear: 'M4 6h10v2H4zm14 0h2v2h-2zM15 4h2v6h-2zM4 16h3v2H4zm7 0h9v2h-9zM8 14h2v6H8z',
    check: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z',
    cross: 'M9 2h6v7h7v6h-7v7H9v-7H2V9h7z',
    tee: 'M2 5h20v6h-7v11H9V11H2z',
    ring: 'M12 3a9 9 0 1 0 9 9h-3a6 6 0 1 1-6-6V3zm2-1 6 3.5-6 3.5z',
    cop: 'M7 5h10l1 3H6zM12 9a3.2 3.2 0 1 1 0 6.4A3.2 3.2 0 0 1 12 9zM5 22v-2.5a7 7 0 0 1 14 0V22z',
    warn: 'M12 2 1 21h22zm-1 6h2v7h-2zm0 9h2v2h-2z',
    light: 'M8 2h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3v2h-2v-2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm4 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
    diamond: 'M12 2 22 12 12 22 2 12zm0 4-6 6 6 6 6-6z',
    plus: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
    turnLeft: 'M9 4 3 9l6 5v-3.5h5a3 3 0 0 1 3 3V21h3v-7.5A6 6 0 0 0 14 7.5H9z',
    sound: 'M4 9v6h4l5 4V5L8 9zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z',
    palette: 'M12 3a9 9 0 0 0 0 18c1 0 1.6-.7 1.6-1.6 0-1.2-1-1.5-1-2.5s.8-1.9 2-1.9H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8zM7.5 12a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z',
    flag: 'M5 2h2v20H5zm3 1h11l-2.5 4L19 11H8z',
    whistle: 'M3 9h9V6h4v3h5a1 1 0 0 1 1 1v2a6 6 0 1 1-12 0v-.5H3z',
    close: 'M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6L19 6.4 17.6 5 12 10.6z',
    cloud: 'M7 19a5 5 0 0 1-.6-10A6 6 0 0 1 18 8.3 4.5 4.5 0 0 1 17.5 19z',
};
const NS = 'http://www.w3.org/2000/svg';
export function icon(name, cls = '') {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', `ic ic-${name}${cls ? ` ${cls}` : ''}`);
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', P[name]);
    path.setAttribute('fill-rule', 'evenodd');
    svg.appendChild(path);
    return svg;
}
/** Row of star icons (filled / empty). */
export function starRow(n, max = 3, cls = '') {
    const span = document.createElement('span');
    span.className = `stars ${cls}`.trim();
    span.setAttribute('aria-label', `${n} / ${max}`);
    for (let i = 0; i < max; i++)
        span.appendChild(icon('star', i < n ? 'on' : 'off'));
    return span;
}
/** Icon + label content for buttons. */
export function label(name, text) {
    return [icon(name), text];
}
export const REASON_ICON = {
    not_found: 'warn',
    not_front: 'clock',
    not_ready: 'clock',
    locked: 'clock',
    controller: 'cop',
    red_light: 'light',
    crossing_traffic: 'warn',
    roundabout_ring: 'ring',
    emergency: 'plus',
    main_road: 'diamond',
    right_hand: 'next',
    left_turn: 'turnLeft',
};
//# sourceMappingURL=icons.js.map