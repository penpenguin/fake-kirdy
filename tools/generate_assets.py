import math
import os
import struct
import zlib
from typing import List, Tuple

Color = Tuple[int, int, int, int]

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def clamp(value: float, min_value: float = 0.0, max_value: float = 1.0) -> float:
    return max(min_value, min(max_value, value))


def lerp(a: int, b: int, t: float) -> int:
    return int(round(a * (1.0 - t) + b * t))


def blend(color_a: Color, color_b: Color, t: float) -> Color:
    return (
        lerp(color_a[0], color_b[0], t),
        lerp(color_a[1], color_b[1], t),
        lerp(color_a[2], color_b[2], t),
        lerp(color_a[3], color_b[3], t),
    )


def create_canvas(width: int, height: int, fill: Color = (0, 0, 0, 0)) -> List[List[Color]]:
    return [[fill for _ in range(width)] for _ in range(height)]


def set_pixel(canvas: List[List[Color]], x: int, y: int, color: Color):
    if 0 <= y < len(canvas) and 0 <= x < len(canvas[0]):
        canvas[y][x] = color


def blit_canvas(destination: List[List[Color]], source: List[List[Color]], origin_x: int, origin_y: int):
    for y, row in enumerate(source):
        for x, color in enumerate(row):
            if color[3] == 0:
                continue
            set_pixel(destination, origin_x + x, origin_y + y, color)


def write_png(path: str, canvas: List[List[Color]]):
    height = len(canvas)
    width = len(canvas[0]) if height > 0 else 0
    raw = bytearray()
    for row in canvas:
        raw.append(0)
        for r, g, b, a in row:
            raw.extend([r, g, b, a])
    compressed = zlib.compress(bytes(raw), level=9)

    def chunk(tag: bytes, payload: bytes) -> bytes:
        return struct.pack('>I', len(payload)) + tag + payload + struct.pack(
            '>I', zlib.crc32(tag + payload) & 0xFFFFFFFF
        )

    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    png_bytes = PNG_SIGNATURE + chunk(b'IHDR', ihdr) + chunk(b'IDAT', compressed) + chunk(b'IEND', b'')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(png_bytes)


PINK_MAIN: Color = (248, 168, 216, 255)
PINK_HIGHLIGHT: Color = (255, 210, 236, 255)
PINK_SHADOW: Color = (212, 112, 178, 255)
CHEEK_PINK: Color = (255, 122, 170, 255)
OUTLINE_PLUM: Color = (108, 31, 79, 255)
EYE_INK: Color = (38, 21, 54, 255)
EYE_SHINE: Color = (255, 244, 255, 255)
MOUTH_SHADOW: Color = (90, 28, 70, 255)
MOUTH_GLOW: Color = (255, 186, 212, 255)

FIRE_CORE: Color = (255, 72, 58, 255)
FIRE_TIP: Color = (255, 196, 70, 255)
ICE_CORE: Color = (84, 178, 255, 255)
ICE_HALO: Color = (218, 244, 255, 255)
SWORD_GOLD: Color = (255, 232, 96, 255)
SWORD_CYAN: Color = (112, 240, 255, 255)
STAR_YELLOW: Color = (255, 234, 90, 255)
STAR_WHITE: Color = (255, 255, 255, 255)
BEE_YELLOW: Color = (245, 200, 55, 255)
BEE_STRIPE: Color = (40, 24, 32, 255)
BEE_WING: Color = (156, 220, 255, 200)
DRONTO_SHELL: Color = (140, 94, 62, 255)
DRONTO_BELLY: Color = (214, 172, 126, 255)
DRONTO_CREST: Color = (130, 98, 170, 255)
DRONTO_OUTLINE: Color = (60, 36, 44, 255)
CONTROL_RING_DARK: Color = (46, 64, 148, 255)
CONTROL_RING_MID: Color = (108, 164, 255, 255)
CONTROL_RING_LIGHT: Color = (156, 212, 255, 255)
CONTROL_GLOW: Color = (74, 212, 255, 255)
CONTROL_PINK: Color = (255, 156, 214, 255)
CONTROL_GOLD: Color = (255, 232, 128, 255)
CONTROL_OUTLINE: Color = (24, 32, 96, 255)
CONTROL_BG: Color = (18, 20, 52, 200)
CONTROL_UP_GLYPH: Color = (122, 218, 255, 255)
CONTROL_LEFT_GLYPH: Color = (90, 208, 255, 255)
CONTROL_RIGHT_GLYPH: Color = (255, 210, 112, 255)
CONTROL_DOWN_GLYPH: Color = (132, 232, 172, 255)
CONTROL_JUMP_GLYPH: Color = (255, 248, 196, 255)
CONTROL_SPIT_GLYPH: Color = (255, 190, 96, 255)
CONTROL_DISCARD_GLYPH: Color = (255, 108, 144, 255)


def generate_kirdy_sprite(size: int, pose: str):
    canvas = create_canvas(size, size)
    cx = size // 2
    cy = int(size * 0.58)
    radius = int(size * 0.36)

    if pose in {'jump', 'hover'}:
        cy = int(size * 0.5)
    if pose == 'run':
        cx = int(size * 0.52)
        cy = int(size * 0.6)
    if pose == 'spit':
        cx = int(size * 0.46)
    if pose == 'inhale':
        cx = int(size * 0.52)

    for y in range(size):
        for x in range(size):
            dx = x - cx
            dy = y - cy
            dist = math.sqrt(dx * dx + dy * dy)
            if dist <= radius:
                t_vertical = clamp((dy + radius) / (2 * radius))
                base = blend(PINK_MAIN, PINK_SHADOW, t_vertical * 0.85)
                highlight_strength = clamp(1 - (dist / radius))
                color = blend(base, PINK_HIGHLIGHT, highlight_strength * 0.7)
                set_pixel(canvas, x, y, color)

    for y in range(size):
        for x in range(size):
            dx = x - cx
            dy = y - cy
            dist = math.sqrt(dx * dx + dy * dy)
            if radius - 1.5 <= dist <= radius + 0.6:
                set_pixel(canvas, x, y, OUTLINE_PLUM)

    cheek_offset_y = int(radius * 0.2)
    cheek_offset_x = int(radius * 0.55)
    for offset_x in (-cheek_offset_x, cheek_offset_x):
        cheek_cx = cx + offset_x
        cheek_cy = cy + cheek_offset_y
        cheek_radius = int(radius * 0.18)
        for y in range(cheek_cy - cheek_radius, cheek_cy + cheek_radius + 1):
            for x in range(cheek_cx - cheek_radius, cheek_cx + cheek_radius + 1):
                if (x - cheek_cx) ** 2 + (y - cheek_cy) ** 2 <= cheek_radius ** 2:
                    set_pixel(canvas, x, y, CHEEK_PINK)

    eye_height = int(radius * 0.9)
    eye_width = int(radius * 0.23)
    eye_spacing = int(radius * 0.35)
    eye_top = cy - int(radius * 0.35)
    for direction in (-1, 1):
        eye_cx = cx + direction * eye_spacing
        for y in range(eye_top, eye_top + eye_height):
            for x in range(eye_cx - eye_width, eye_cx + eye_width + 1):
                set_pixel(canvas, x, y, EYE_INK)
        if pose in {'swallow', 'hover'}:
            lid_y = eye_top + eye_height // 3
            for x in range(eye_cx - eye_width, eye_cx + eye_width + 1):
                set_pixel(canvas, x, lid_y, OUTLINE_PLUM)
                set_pixel(canvas, x, lid_y + 1, OUTLINE_PLUM)
        else:
            set_pixel(canvas, eye_cx - eye_width + 1, eye_top + 1, EYE_SHINE)

    mouth_y = cy + int(radius * 0.25)
    if pose == 'inhale':
        inhale_radius = int(radius * 0.38)
        for y in range(mouth_y - inhale_radius, mouth_y + inhale_radius + 1):
            for x in range(cx - inhale_radius, cx + inhale_radius + 1):
                if (x - cx) ** 2 + (y - mouth_y) ** 2 <= inhale_radius ** 2:
                    set_pixel(canvas, x, y, blend(MOUTH_SHADOW, ICE_CORE, 0.3))
        swirl_radius = int(radius * 0.55)
        for angle_step in range(0, 360, 10):
            angle = math.radians(angle_step)
            rx = int(cx + math.cos(angle) * swirl_radius * 0.6)
            ry = int(mouth_y - radius * 0.3 + math.sin(angle) * swirl_radius * 0.4)
            set_pixel(canvas, rx, ry, blend(MOUTH_GLOW, ICE_HALO, 0.5))
    elif pose == 'spit':
        for y in range(mouth_y - 2, mouth_y + 3):
            for x in range(cx - 6, cx + 18):
                set_pixel(canvas, x, y, MOUTH_SHADOW)
        for x in range(cx + 8, cx + 19):
            set_pixel(canvas, x, mouth_y, STAR_WHITE)
            set_pixel(canvas, x, mouth_y - 1, STAR_YELLOW)
            set_pixel(canvas, x, mouth_y + 1, STAR_YELLOW)
    elif pose == 'swallow':
        for y in range(mouth_y, mouth_y + 4):
            for x in range(cx - 6, cx + 7):
                set_pixel(canvas, x, y, blend(MOUTH_SHADOW, PINK_SHADOW, 0.4))
    else:
        for y in range(mouth_y - 1, mouth_y + 2):
            for x in range(cx - 5, cx + 6):
                set_pixel(canvas, x, y, MOUTH_SHADOW)
        set_pixel(canvas, cx, mouth_y - 1, MOUTH_GLOW)

    arm_radius = int(radius * 0.3)
    foot_y = cy + int(radius * 0.75)
    for direction in (-1, 1):
        arm_cx = cx + direction * int(radius * 0.9)
        arm_cy = cy
        for y in range(arm_cy - arm_radius, arm_cy + arm_radius + 1):
            for x in range(arm_cx - arm_radius, arm_cx + arm_radius + 1):
                if (x - arm_cx) ** 2 + (y - arm_cy) ** 2 <= arm_radius ** 2:
                    set_pixel(canvas, x, y, blend(PINK_MAIN, PINK_HIGHLIGHT, 0.4))
        foot_cx = cx + direction * int(radius * 0.5)
        for y in range(foot_y - 3, foot_y + 2):
            for x in range(foot_cx - 4, foot_cx + 5):
                set_pixel(canvas, x, y, blend(PINK_SHADOW, MOUTH_SHADOW, 0.3))

    if pose == 'run':
        for offset in range(0, 10):
            x = cx - radius - 6 - offset
            y = cy - 6 + offset // 3
            set_pixel(canvas, x, y, blend(PINK_HIGHLIGHT, STAR_WHITE, 0.4))
    if pose == 'hover':
        for direction in (-1, 1):
            wing_y = cy + int(radius * 0.8)
            for y in range(wing_y, wing_y + 6):
                for x in range(cx + direction * (radius - 4), cx + direction * (radius + 8)):
                    set_pixel(canvas, x, y, blend(PINK_HIGHLIGHT, STAR_WHITE, 0.3))
    if pose == 'jump':
        for sparkle in range(6):
            angle = math.radians(60 * sparkle)
            rx = int(cx + math.cos(angle) * radius * 1.2)
            ry = int(cy + math.sin(angle) * radius * 0.6)
            set_pixel(canvas, rx, ry, STAR_WHITE)
    if pose == 'idle':
        for sparkle in range(8):
            angle = math.radians(45 * sparkle)
            rx = int(cx + math.cos(angle) * radius * 1.4)
            ry = int(cy + math.sin(angle) * radius * 1.0)
            set_pixel(canvas, rx, ry, blend(PINK_HIGHLIGHT, STAR_WHITE, 0.5))

    set_pixel(canvas, cx, cy, PINK_MAIN)
    set_pixel(canvas, cx + radius, cy, OUTLINE_PLUM)

    return canvas


def generate_fire_projectile():
    size = 64
    canvas = create_canvas(size, size)
    cx = size // 2
    cy = size // 2
    base_radius = 20
    for y in range(size):
        for x in range(size):
            dx = x - cx
            dy = (y - cy) * 1.2
            dist = math.sqrt(dx * dx + dy * dy)
            if dist <= base_radius:
                t = clamp(dist / base_radius)
                set_pixel(canvas, x, y, blend(FIRE_CORE, FIRE_TIP, t))
            elif base_radius < dist <= base_radius + 2 and y < cy:
                set_pixel(canvas, x, y, blend(FIRE_TIP, STAR_WHITE, 0.3))
    for i in range(-2, 3):
        set_pixel(canvas, cx + i * 3, cy - base_radius - 4, FIRE_CORE)
        set_pixel(canvas, cx + i * 3, cy - base_radius - 5, FIRE_TIP)
    set_pixel(canvas, cx, cy, FIRE_CORE)
    set_pixel(canvas, cx, cy - base_radius, FIRE_TIP)
    return canvas


def generate_ice_projectile():
    size = 64
    canvas = create_canvas(size, size)
    cx = size // 2
    cy = size // 2
    radius = 18
    for y in range(size):
        for x in range(size):
            dx = (x - cx) * 1.1
            dy = (y - cy) * 0.9
            dist = math.sqrt(dx * dx + dy * dy)
            if dist <= radius:
                t = clamp(dist / radius)
                set_pixel(canvas, x, y, blend(ICE_CORE, ICE_HALO, t))
    for angle in range(0, 360, 45):
        rad = math.radians(angle)
        for s in range(radius, radius + 6):
            x = int(cx + math.cos(rad) * s)
            y = int(cy + math.sin(rad) * s)
            set_pixel(canvas, x, y, ICE_HALO)
    set_pixel(canvas, cx, cy, ICE_CORE)
    set_pixel(canvas, cx + radius - 2, cy, ICE_HALO)
    return canvas


def generate_sword_slash():
    size = 64
    canvas = create_canvas(size, size)
    cx = size // 2
    cy = size // 2
    inner = 16
    outer = 24
    for y in range(size):
        for x in range(size):
            dx = x - cx
            dy = y - cy
            dist = math.sqrt(dx * dx + dy * dy)
            if inner <= dist <= outer:
                t = clamp((dist - inner) / (outer - inner))
                color = blend(SWORD_GOLD, SWORD_CYAN, t)
                if dy < 0:
                    color = blend(color, STAR_WHITE, 0.2)
                set_pixel(canvas, x, y, color)
    for i in range(-3, 4):
        set_pixel(canvas, cx + i * 2, cy - outer - 4, SWORD_CYAN)
    set_pixel(canvas, cx, cy + inner, SWORD_GOLD)
    return canvas


def generate_star_bullet():
    size = 64
    canvas = create_canvas(size, size)
    cx = size // 2
    cy = size // 2
    points = 5
    outer = 24
    inner = 10
    polygon = []
    for i in range(points * 2):
        angle = math.pi / points * i
        radius = outer if i % 2 == 0 else inner
        polygon.append((cx + math.sin(angle) * radius, cy - math.cos(angle) * radius))
    min_x = int(min(p[0] for p in polygon))
    max_x = int(max(p[0] for p in polygon))
    min_y = int(min(p[1] for p in polygon))
    max_y = int(max(p[1] for p in polygon))
    for y in range(min_y, max_y + 1):
        for x in range(min_x, max_x + 1):
            inside = False
            j = len(polygon) - 1
            for i, (xi, yi) in enumerate(polygon):
                xj, yj = polygon[j]
                if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi):
                    inside = not inside
                j = i
            if inside:
                dist = math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
                t = clamp(dist / outer)
                set_pixel(canvas, x, y, blend(STAR_WHITE, STAR_YELLOW, t * 0.8))
    set_pixel(canvas, cx, cy, STAR_WHITE)
    set_pixel(canvas, cx + outer - 2, cy, STAR_YELLOW)
    return canvas


def generate_wabble_bee():
    size = 64
    canvas = create_canvas(size, size)
    cx = size // 2
    cy = size // 2
    body_radius_x = 20
    body_radius_y = 16
    for y in range(size):
        for x in range(size):
            dx = (x - cx) / body_radius_x
            dy = (y - cy) / body_radius_y
            if dx * dx + dy * dy <= 1.0:
                set_pixel(canvas, x, y, BEE_YELLOW)
    for y in range(cy - 10, cy + 11, 6):
        for stripe_height in range(0, 4):
            for x in range(cx - body_radius_x, cx + body_radius_x + 1):
                stripe_y = y + stripe_height
                if 0 <= stripe_y < size:
                    set_pixel(canvas, x, stripe_y, BEE_STRIPE)
    wing_offset_y = cy - body_radius_y - 6
    for direction in (-1, 1):
        wing_cx = cx + direction * 12
        for y in range(wing_offset_y, wing_offset_y + 14):
            for x in range(wing_cx - 10, wing_cx + 11):
                dx = (x - wing_cx) / 10
                dy = (y - wing_offset_y) / 14
                if dx * dx + dy * dy <= 1.0:
                    set_pixel(canvas, x, y, BEE_WING)
    for direction in (-1, 1):
        eye_x = cx + direction * 8
        eye_y = cy - 4
        set_pixel(canvas, eye_x, eye_y, BEE_STRIPE)
        set_pixel(canvas, eye_x, eye_y + 1, BEE_STRIPE)
        set_pixel(canvas, eye_x, eye_y - 1, STAR_WHITE)
    for i in range(4):
        set_pixel(canvas, cx - body_radius_x - i, cy + 2 + i // 2, BEE_STRIPE)
    set_pixel(canvas, cx, cy, BEE_YELLOW)
    set_pixel(canvas, cx, cy - body_radius_y, BEE_STRIPE)
    set_pixel(canvas, cx + 12, wing_offset_y + 4, BEE_WING)
    return canvas


def generate_dronto_durt():
    size = 64
    canvas = create_canvas(size, size)
    cx = size // 2
    cy = size // 2 + 4
    body_rx = 18
    body_ry = 16
    for y in range(size):
        for x in range(size):
            dx = (x - cx) / body_rx
            dy = (y - cy) / body_ry
            if dx * dx + dy * dy <= 1.0:
                t = clamp((dy + 1) / 2)
                set_pixel(canvas, x, y, blend(DRONTO_SHELL, DRONTO_BELLY, t))
    for y in range(size):
        for x in range(size):
            dx = (x - cx) / body_rx
            dy = (y - cy) / body_ry
            dist = dx * dx + dy * dy
            if 0.95 <= dist <= 1.08:
                set_pixel(canvas, x, y, DRONTO_OUTLINE)
    for y in range(cy - 4, cy + 10):
        for x in range(cx - 6, cx + 7):
            dx = (x - cx) / 6
            dy = (y - (cy + 2)) / 10
            if dx * dx + dy * dy <= 1.0:
                set_pixel(canvas, x, y, DRONTO_BELLY)
    crest_base_y = cy - body_ry - 6
    for y in range(crest_base_y, crest_base_y + 12):
        for x in range(cx - 4, cx + 5):
            dx = (x - cx) / 4
            dy = (y - crest_base_y) / 12
            if dx * dx + dy * dy <= 1.0:
                set_pixel(canvas, x, y, DRONTO_CREST)
    eye_y = cy - 4
    for direction in (-1, 1):
        eye_x = cx + direction * 6
        set_pixel(canvas, eye_x, eye_y, DRONTO_OUTLINE)
        set_pixel(canvas, eye_x, eye_y - 1, STAR_WHITE)
    for x in range(cx - 6, cx + 7):
        set_pixel(canvas, x, cy + 8, DRONTO_OUTLINE)
    set_pixel(canvas, cx, cy + 7, DRONTO_OUTLINE)
    set_pixel(canvas, cx + body_rx - 1, cy, DRONTO_SHELL)
    set_pixel(canvas, cx, cy + 4, DRONTO_BELLY)
    set_pixel(canvas, cx, crest_base_y + 2, DRONTO_CREST)
    return canvas


def draw_control_base(frame: List[List[Color]]):
    size = len(frame)
    cx = size // 2
    cy = size // 2
    ring_radius = int(size * 0.38)
    halo_radius = int(size * 0.47)

    for y in range(size):
        for x in range(size):
            dx = x - cx
            dy = y - cy
            dist = math.sqrt(dx * dx + dy * dy)
            if dist <= ring_radius:
                t = clamp(dist / ring_radius)
                if t < 0.55:
                    color = blend(CONTROL_RING_DARK, CONTROL_RING_MID, t / 0.55)
                else:
                    color = blend(CONTROL_RING_MID, CONTROL_RING_LIGHT, (t - 0.55) / 0.45)
                if dy < 0:
                    highlight = clamp((abs(dy) / ring_radius) * 0.3)
                    color = blend(color, CONTROL_GLOW, highlight)
                set_pixel(frame, x, y, color)
            elif dist <= halo_radius:
                alpha = max(0, int(180 - (dist - ring_radius) * 90))
                if alpha > 0:
                    set_pixel(frame, x, y, (CONTROL_BG[0], CONTROL_BG[1], CONTROL_BG[2], alpha))

    for angle in range(0, 360, 4):
        rad = math.radians(angle)
        x = int(cx + math.cos(rad) * ring_radius)
        y = int(cy + math.sin(rad) * ring_radius)
        set_pixel(frame, x, y, CONTROL_OUTLINE)

    for angle in range(-50, 51, 5):
        rad = math.radians(angle)
        radius = ring_radius - 6
        x = int(cx + math.cos(rad) * radius)
        y = int(cy + math.sin(rad) * radius)
        set_pixel(frame, x, y, CONTROL_GOLD)


def draw_up_arrow(frame: List[List[Color]]):
    size = len(frame)
    cx = size // 2
    cy = size // 2
    shaft = 26
    width = 7
    for i in range(shaft):
        y = cy + 8 - i
        for dx in range(-width, width + 1):
            set_pixel(frame, cx + dx, y, CONTROL_UP_GLYPH)
    tip_length = 16
    for i in range(tip_length):
        y = cy + 8 - shaft - i
        span = max(2, width - i // 2)
        for dx in range(-span, span + 1):
            set_pixel(frame, cx + dx, y, CONTROL_UP_GLYPH)


def draw_left_arrow(frame: List[List[Color]]):
    size = len(frame)
    cx = size // 2
    cy = size // 2
    shaft = 26
    width = 7
    for i in range(shaft):
        x = cx + 8 - i
        for dy in range(-width, width + 1):
            set_pixel(frame, x, cy + dy, CONTROL_LEFT_GLYPH)
    tip_length = 16
    for i in range(tip_length):
        x = cx + 8 - shaft - i
        span = max(2, width - i // 2)
        for dy in range(-span, span + 1):
            set_pixel(frame, x, cy + dy, CONTROL_LEFT_GLYPH)


def draw_right_arrow(frame: List[List[Color]]):
    size = len(frame)
    cx = size // 2
    cy = size // 2
    shaft = 26
    width = 7
    for i in range(shaft):
        x = cx - 8 + i
        for dy in range(-width, width + 1):
            set_pixel(frame, x, cy + dy, CONTROL_RIGHT_GLYPH)
    tip_length = 16
    for i in range(tip_length):
        x = cx - 8 + shaft + i
        span = max(2, width - i // 2)
        for dy in range(-span, span + 1):
            set_pixel(frame, x, cy + dy, CONTROL_RIGHT_GLYPH)


def draw_jump_glyph(frame: List[List[Color]]):
    size = len(frame)
    cx = size // 2
    cy = size // 2 + 8
    shaft_height = 28
    half_width = 5
    for i in range(shaft_height):
        y = cy - i
        for dx in range(-half_width, half_width + 1):
            set_pixel(frame, cx + dx, y, CONTROL_JUMP_GLYPH)
    for i in range(12):
        y = cy - shaft_height - i
        span = half_width + 2 - i // 2
        for dx in range(-span, span + 1):
            set_pixel(frame, cx + dx, y, CONTROL_JUMP_GLYPH)
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            if abs(dx) + abs(dy) <= 2:
                set_pixel(frame, cx + dx, cy + 6 + dy, CONTROL_GLOW)


def draw_inhale_swirl(frame: List[List[Color]]):
    size = len(frame)
    cx = size // 2 - 2
    cy = size // 2
    for angle in range(-120, 100, 4):
        rad = math.radians(angle)
        t = (angle + 120) / 220
        radius = 10 + t * 18
        x = int(cx + math.cos(rad) * radius)
        y = int(cy + math.sin(rad) * radius * 0.6)
        thickness = 2 + int(t * 2)
        for offset in range(-thickness, thickness + 1):
            set_pixel(frame, x, y + offset, CONTROL_PINK)


def draw_down_arrow(frame: List[List[Color]]):
    size = len(frame)
    cx = size // 2
    cy = size // 2
    shaft = 26
    width = 7
    for i in range(shaft):
        y = cy - 8 + i
        for dx in range(-width, width + 1):
            set_pixel(frame, cx + dx, y, CONTROL_DOWN_GLYPH)
    tip_length = 16
    for i in range(tip_length):
        y = cy - 8 + shaft + i
        span = max(2, width - i // 2)
        for dx in range(-span, span + 1):
            set_pixel(frame, cx + dx, y, CONTROL_DOWN_GLYPH)


def draw_spit_star(frame: List[List[Color]]):
    size = len(frame)
    cx = size // 2
    cy = size // 2
    points = 5
    outer = 22
    inner = 10
    polygon = []
    for i in range(points * 2):
        angle = math.pi / points * i
        radius = outer if i % 2 == 0 else inner
        polygon.append((cx + math.sin(angle) * radius, cy - math.cos(angle) * radius))
    min_x = int(min(p[0] for p in polygon))
    max_x = int(max(p[0] for p in polygon))
    min_y = int(min(p[1] for p in polygon))
    max_y = int(max(p[1] for p in polygon))
    for y in range(min_y, max_y + 1):
        for x in range(min_x, max_x + 1):
            inside = False
            j = len(polygon) - 1
            for i, (xi, yi) in enumerate(polygon):
                xj, yj = polygon[j]
                if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi):
                    inside = not inside
                j = i
            if inside:
                set_pixel(frame, x, y, CONTROL_SPIT_GLYPH)
    set_pixel(frame, cx, cy, STAR_WHITE)


def draw_discard_cross(frame: List[List[Color]]):
    size = len(frame)
    cx = size // 2
    cy = size // 2
    extent = 18
    for offset in range(-extent, extent + 1):
        for thickness in range(-2, 3):
            set_pixel(frame, cx + offset, cy + offset + thickness, CONTROL_DISCARD_GLYPH)
            set_pixel(frame, cx + offset, cy - offset + thickness, CONTROL_DISCARD_GLYPH)


def generate_virtual_controls():
    frame_size = 96
    columns = 4
    rows = 2
    width = frame_size * columns
    height = frame_size * rows
    sheet = create_canvas(width, height)

    layout = [
        ('dpad-up', 0, 0, draw_up_arrow),
        ('dpad-left', 1, 0, draw_left_arrow),
        ('dpad-down', 2, 0, draw_down_arrow),
        ('dpad-right', 3, 0, draw_right_arrow),
        ('spit', 0, 1, draw_spit_star),
        ('discard', 1, 1, draw_discard_cross),
        ('inhale', 2, 1, draw_inhale_swirl),
    ]

    for _key, column, row, glyph in layout:
        frame = create_canvas(frame_size, frame_size)
        draw_control_base(frame)
        glyph(frame)
        blit_canvas(sheet, frame, column * frame_size, row * frame_size)

    return sheet


def generate_virtual_controls_fallback():
    size = 32
    canvas = create_canvas(size, size)
    cx = size // 2
    cy = size // 2
    radius = 14

    for y in range(size):
        for x in range(size):
            dx = x - cx
            dy = y - cy
            dist = math.sqrt(dx * dx + dy * dy)
            if dist <= radius:
                t = clamp(dist / radius)
                color = blend(CONTROL_RING_MID, CONTROL_PINK, t * 0.8)
                set_pixel(canvas, x, y, color)
            elif radius < dist <= radius + 1:
                set_pixel(canvas, x, y, CONTROL_OUTLINE)

    for offset in range(-radius, radius + 1):
        x = cx + offset
        y = cy - offset // 2
        for thickness in range(-1, 2):
            set_pixel(canvas, x, y + thickness, CONTROL_GOLD)

    for y in range(cy - radius // 2, cy - radius // 2 + 4):
        for x in range(cx + radius // 2, cx + radius // 2 + 4):
            set_pixel(canvas, x, y, CONTROL_PINK)

    set_pixel(canvas, cx, cy, CONTROL_LEFT_GLYPH)

    return canvas


def main():
    root = os.path.join('public', 'assets', 'images')
    assets = {
        'kirdy.png': generate_kirdy_sprite(64, 'neutral'),
        'kirdy-run.png': generate_kirdy_sprite(64, 'run'),
        'kirdy-jump.png': generate_kirdy_sprite(64, 'jump'),
        'kirdy-hover.png': generate_kirdy_sprite(64, 'hover'),
        'kirdy-inhale.png': generate_kirdy_sprite(64, 'inhale'),
        'kirdy-swallow.png': generate_kirdy_sprite(64, 'swallow'),
        'kirdy-spit.png': generate_kirdy_sprite(64, 'spit'),
        'kirdy-idle.png': generate_kirdy_sprite(96, 'idle'),
        'fire-attack.png': generate_fire_projectile(),
        'ice-attack.png': generate_ice_projectile(),
        'sword-slash.png': generate_sword_slash(),
        'star-bullet.png': generate_star_bullet(),
        'wabble-bee.png': generate_wabble_bee(),
        'dronto-durt.png': generate_dronto_durt(),
        'virtual-controls.png': generate_virtual_controls(),
        os.path.join('fallbacks', 'virtual-controls.png'): generate_virtual_controls_fallback(),
    }

    for name, canvas in assets.items():
        path = os.path.join(root, name)
        write_png(path, canvas)
        print(f'Wrote {path}')


if __name__ == '__main__':
    main()
