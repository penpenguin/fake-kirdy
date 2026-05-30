shader_type canvas_item;

uniform sampler2D screen_texture : hint_screen_texture, repeat_disable, filter_linear_mipmap;
uniform float blur_px = 2.0;
uniform vec4 tint_color : source_color = vec4(0.02, 0.03, 0.07, 0.30);

void fragment() {
    vec2 texel = SCREEN_PIXEL_SIZE * blur_px;
    vec4 color = texture(screen_texture, SCREEN_UV) * 0.28;
    color += texture(screen_texture, SCREEN_UV + vec2(texel.x, 0.0)) * 0.18;
    color += texture(screen_texture, SCREEN_UV - vec2(texel.x, 0.0)) * 0.18;
    color += texture(screen_texture, SCREEN_UV + vec2(0.0, texel.y)) * 0.18;
    color += texture(screen_texture, SCREEN_UV - vec2(0.0, texel.y)) * 0.18;
    COLOR = mix(color, tint_color, tint_color.a);
}
