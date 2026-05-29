// Per-browser display labels for handles. Server never sees these.
// Map keyed by handle; values are user-chosen display names.

const STORAGE_KEY = "ppmap:labels";

function read() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
}

function write(map) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {
        // out of quota or storage disabled; silently skip
    }
}

export function getLabel(handle) {
    if (!handle) return "";
    const map = read();
    return typeof map[handle] === "string" ? map[handle] : "";
}

export function setLabel(handle, label) {
    if (!handle) return;
    const map = read();
    if (!label) {
        delete map[handle];
    } else {
        map[handle] = label;
    }
    write(map);
}

export function allLabels() {
    return read();
}
