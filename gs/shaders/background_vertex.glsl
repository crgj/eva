attribute vec3 a_pos;
attribute vec2 a_texCoord;

uniform mat4 projmatrix;

varying vec2 v_texCoord;

void main() {
    gl_Position = projmatrix * vec4(a_pos, 1.0);
    v_texCoord = a_texCoord;
}
