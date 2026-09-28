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
    coin: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2.6a7.4 7.4 0 1 1 0 14.8 7.4 7.4 0 0 1 0-14.8zm0 1.6a5.8 5.8 0 1 0 0 11.6 5.8 5.8 0 0 0 0-11.6zm0 1.9 1.2 2.5 2.7.3-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.3z',
    clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm-1 3v6l5 3 1-1.7-4-2.3V7z',
    car: 'M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11h1a1 1 0 0 1 1 1v5h-2v2h-3v-2H8v2H5v-2H3v-5a1 1 0 0 1 1-1zm2.2 0h9.6l-1-3.2H8.2zM6.5 15a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6zm11 0a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6z',
    lock: 'M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z',
    back: 'M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z',
    next: 'M4 11h12.2l-5.6-5.6L12 4l8 8-8 8-1.4-1.4 5.6-5.6H4z',
    map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zm0 2.2 6 2v11.6l-6-2z',
    wrench: 'M21 7.5a5.5 5.5 0 0 1-7.4 5.2l-7.3 7.3a2 2 0 1 1-2.8-2.8l7.3-7.3A5.5 5.5 0 0 1 17.5 2.4l-3.2 3.2 1.1 3 3 1.1z',
    book: 'M2 5.2c3.1-1.5 6.2-1.5 9 .3v14.7c-2.8-1.6-5.9-1.6-9-.2zm11 .3c2.8-1.8 5.9-1.8 9-.3v14.8c-3.1-1.4-6.2-1.4-9 .2zM4 7.6v1.5c1.7-.5 3.4-.4 5 .3V7.9c-1.6-.7-3.3-.8-5-.3zm0 3.4v1.5c1.7-.5 3.4-.4 5 .3v-1.5c-1.6-.7-3.3-.8-5-.3zm11-3.1v1.5c1.6-.7 3.3-.8 5-.3V7.6c-1.7-.5-3.4-.4-5 .3z',
    gear: 'M4 6h10v2H4zm14 0h2v2h-2zM15 4h2v6h-2zM4 16h3v2H4zm7 0h9v2h-9zM8 14h2v6H8z',
    check: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z',
    cross: 'M9 2h6v7h7v6h-7v7H9v-7H2V9h7zm1.7 1.7v7h-7v2.6h7v7h2.6v-7h7v-2.6h-7v-7z',
    tee: 'M2 5h20v6h-7v11H9V11H2zm1.7 1.7v2.6h7v11h2.6v-11h7V6.7z',
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
    moon: 'M20.5 14.6A8.6 8.6 0 1 1 9.4 3.5a7 7 0 0 0 11.1 11.1z',
    sun: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM11 1h2v3h-2zm0 19h2v3h-2zM1 11h3v2H1zm19 0h3v2h-3zM4.2 5.6l1.4-1.4 2.1 2.1-1.4 1.4zm12.1 12.1 1.4-1.4 2.1 2.1-1.4 1.4zM4.2 18.4l2.1-2.1 1.4 1.4-2.1 2.1zM16.3 6.3l2.1-2.1 1.4 1.4-2.1 2.1z',
    sunset: 'M12 9a5 5 0 0 1 5 5H7a5 5 0 0 1 5-5zM11 3h2v3h-2zM3.5 7l1.4-1.4 2.1 2.1-1.4 1.4zm13.5.7 2.1-2.1L20.5 7l-2.1 2.1zM1 13h3v2H1zm19 0h3v2h-3zM2 17h20v2H2zm4 3h12v2H6z',
    rain: 'M7 14a4.5 4.5 0 0 1-.5-9A5.5 5.5 0 0 1 17 5.5 4 4 0 0 1 17 14zm1 2h2l-1.5 4.5h-2zm4.5 0h2L13 20.5h-2zm4.5 0h2l-1.5 4.5h-2z',
    trophy: 'M7 2h10v2h4v3.5a4.5 4.5 0 0 1-4.3 4.5A5 5 0 0 1 13 15.8V18h3v3H8v-3h3v-2.2A5 5 0 0 1 7.3 12 4.5 4.5 0 0 1 3 7.5V4h4zm0 4H5v1.5a2.5 2.5 0 0 0 2 2.4zm10 0v3.9a2.5 2.5 0 0 0 2-2.4V6z',
    medal: 'M5 2h4.5l2.5 4.4L14.5 2H19l-4.2 7.4A6.5 6.5 0 1 1 9.2 9.4zm7 8.6a4.7 4.7 0 1 0 0 9.4 4.7 4.7 0 0 0 0-9.4zm0 1.6 1.1 2.3 2.5.3-1.8 1.7.5 2.5-2.3-1.2-2.3 1.2.5-2.5-1.8-1.7 2.5-.3z',
    crown: 'M2.5 7.5 7.6 11 12 4l4.4 7 5.1-3.5-2 10.5h-15zM4.8 19.8h14.4V22H4.8z',
    chart: 'M3 20h18v2H3zM5 12h3.5v7H5zm5.3-7h3.4v14h-3.4zM15.5 9H19v10h-3.5z',
    fire: 'M13.2 1.5c.6 3.4 5.3 5.4 5.3 11a6.5 6.5 0 0 1-13 0c0-2.8 1.4-4.8 3-6.2.1 2 .9 3.3 2.2 4-.5-3.7.6-6.6 2.5-8.8zM12 13.2c-1.6 1.3-2.5 2.6-2.5 4.1a2.5 2.5 0 0 0 5 0c0-1.5-.9-2.8-2.5-4.1z',
    infinity: 'M7 7a5 5 0 1 0 3.5 8.6L12 14.2l1.5 1.4A5 5 0 1 0 17 7c-2 0-3.4 1.1-5 3-1.6-1.9-3-3-5-3zm0 2.8c1 0 1.9.7 3.1 2.2-1.2 1.5-2.1 2.2-3.1 2.2a2.2 2.2 0 1 1 0-4.4zm10 0a2.2 2.2 0 1 1 0 4.4c-1 0-1.9-.7-3.1-2.2 1.2-1.5 2.1-2.2 3.1-2.2z',
    calendar: 'M7 2h2v2h6V2h2v2h2.5A1.5 1.5 0 0 1 21 5.5v14a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5v-14A1.5 1.5 0 0 1 4.5 4H7zM5 9v10h14V9zm2 2h4v4H7z',
    share: 'M18 15.5a3 3 0 0 0-2.3 1.1l-6.8-3.4a3.1 3.1 0 0 0 0-1.4l6.8-3.4A3 3 0 1 0 15 6.5c0 .2 0 .5.1.7L8.3 10.6a3 3 0 1 0 0 2.8l6.8 3.4-.1.7a3 3 0 1 0 3-2z',
    speed: 'M2 6l9 6-9 6zm10 0 9 6-9 6z',
    soundOff: 'M4 9v6h4l5 4V5L8 9zm11.3.5 1.4-1.4 2.1 2.1 2.1-2.1 1.4 1.4-2.1 2.1 2.1 2.1-1.4 1.4-2.1-2.1-2.1 2.1-1.4-1.4 2.1-2.1z',
    keyboard: 'M3 5.5h18A1.5 1.5 0 0 1 22.5 7v10a1.5 1.5 0 0 1-1.5 1.5H3A1.5 1.5 0 0 1 1.5 17V7A1.5 1.5 0 0 1 3 5.5zM4.5 8.5v2h2v-2zm3.5 0v2h2v-2zm3.5 0v2h2v-2zm3.5 0v2h2v-2zm3.5 0v2h1.5v-2zM4.5 12v2h2v-2zm3.5 0v2h8v-2zm9.5 0v2h2v-2zm-11 3.5v1.5h11v-1.5z',
    install: 'M11 2h2v10.2l3.3-3.3 1.4 1.4L12 16l-5.7-5.7 1.4-1.4 3.3 3.3zM3 15h2v4h14v-4h2v6H3z',
    hand: 'M9.8 1.8a1.6 1.6 0 0 1 1.6 1.6v6.2h.9V8.3a1.6 1.6 0 0 1 3.2 0v1.3h.8V9a1.6 1.6 0 0 1 3.2 0v5.6a7.2 7.2 0 0 1-7.2 7.2h-.6a6.2 6.2 0 0 1-5-2.5L3.8 16a1.7 1.7 0 0 1 2.6-2.1l1.8 1.8V3.4a1.6 1.6 0 0 1 1.6-1.6z',
    eye: 'M12 5c5.2 0 9 4.4 10 7-1 2.6-4.8 7-10 7S3 14.6 2 12c1-2.6 4.8-7 10-7zm0 2.8a4.2 4.2 0 1 0 0 8.4 4.2 4.2 0 0 0 0-8.4zm0 2.2a2 2 0 1 1 0 4 2 2 0 0 1 0-4z',
    user: 'M12 2.5a4.8 4.8 0 1 1 0 9.6 4.8 4.8 0 0 1 0-9.6zM3.5 21.5a8.5 8.5 0 0 1 17 0z',
    target: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2.8a7.2 7.2 0 1 1 0 14.4 7.2 7.2 0 0 1 0-14.4zm0 2.8a4.4 4.4 0 1 0 0 8.8 4.4 4.4 0 0 0 0-8.8zm0 2.8a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2z',
    link: 'M10.6 13.4a1 1 0 0 1 0-1.4l3.5-3.5a1 1 0 1 1 1.4 1.4L12 13.4a1 1 0 0 1-1.4 0zM8 19.5a4.5 4.5 0 0 1-3.2-7.7l2.5-2.5 1.4 1.4-2.5 2.5a2.5 2.5 0 1 0 3.5 3.5l2.5-2.5 1.4 1.4-2.5 2.5A4.5 4.5 0 0 1 8 19.5zm8.7-4.8-1.4-1.4 2.5-2.5a2.5 2.5 0 1 0-3.5-3.5l-2.5 2.5-1.4-1.4 2.5-2.5a4.5 4.5 0 1 1 6.3 6.3z',
    history: 'M13 3a9 9 0 1 1-8.5 12h2.2A7 7 0 1 0 6.3 8.3L8.5 10.5H2.5v-6l2.4 2.4A9 9 0 0 1 13 3zm-1 4h2v5l4 2.3-1 1.7-5-3z',
};
export function isIconName(x) {
    return Object.prototype.hasOwnProperty.call(P, x);
}
/** Icon by (content-provided) name with a safe fallback. */
export function iconOf(name, cls = '', fallback = 'star') {
    return icon(isIconName(name) ? name : fallback, cls);
}
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
/** Ambience → icon. */
export const AMBIENCE_ICON = {
    day: 'sun',
    evening: 'sunset',
    night: 'moon',
    rain: 'rain',
};
export const AMBIENCE_UZ = {
    day: 'Kunduz',
    evening: 'Kechqurun',
    night: 'Tun',
    rain: "Yomg'ir",
};
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