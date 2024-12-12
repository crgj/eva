class BackgroundRenderer {
    async init() {
        // 加载全景图纹理
        const panoramaImage = await this.loadImage('./images/bg.jpg');
        this.texture = this.createTexture(panoramaImage);


        // 创建着色器程序
        const vertexShaderSource = await fetchFile('gs/shaders/background_vertex.glsl');
        const fragmentShaderSource = await fetchFile('gs/shaders/background_fragment.glsl');
        this.program = createProgram(gl, vertexShaderSource, fragmentShaderSource);

        // 创建球体缓冲区
        this.sphereBuffer = gl.createBuffer();

        // 初始化球体顶点数据
        this.setSphereVertices();
    }

    // 加载图像并返回一个 Promise
    loadImage(url) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = (err) => reject(err);
            image.src = url;
        });
    }

    // 生成球体顶点和纹理坐标
    setSphereVertices(radius = 2, latitudeBands = 30, longitudeBands = 30) {
        this.sphereVertices = [];
        this.sphereTexCoords = [];

        for (let latNumber = 0; latNumber <= latitudeBands; ++latNumber) {
            const theta = latNumber * Math.PI / latitudeBands;
            const sinTheta = Math.sin(theta);
            const cosTheta = Math.cos(theta);

            for (let longNumber = 0; longNumber <= longitudeBands; ++longNumber) {
                const phi = longNumber * 2 * Math.PI / longitudeBands;
                const sinPhi = Math.sin(phi);
                const cosPhi = Math.cos(phi);

                // 计算顶点坐标
                const x = radius * cosPhi * sinTheta;
                const y = radius * cosTheta;
                const z = radius * sinPhi * sinTheta;

                this.sphereVertices.push(x, y, z);

                // 计算纹理坐标
                const u = 1 - (longNumber / longitudeBands);
                const v = 1 - (latNumber / latitudeBands);
                this.sphereTexCoords.push(u, v);
            }
        }
    }

    // 创建纹理
    createTexture(image) {
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.bindTexture(gl.TEXTURE_2D, null);
        return texture;
    }

    // 渲染背景球
    render() {

        //console.log(this.texture)
        //if (!this.texture || this.sphereVertices.length === 0) return;

        gl.useProgram(this.program);
    

        // 绑定缓冲区并更新数据
        gl.bindBuffer(gl.ARRAY_BUFFER, this.sphereBuffer);
        const vertices = new Float32Array(this.sphereVertices);
        const texCoords = new Float32Array(this.sphereTexCoords);
        
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        // 获取属性位置
        const positionLocation = gl.getAttribLocation(this.program, 'a_pos');
        gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(positionLocation);

        // 绑定纹理坐标
        const texCoordLocation = gl.getAttribLocation(this.program, 'a_texCoord');
        gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, vertices.length * 4);
        gl.enableVertexAttribArray(texCoordLocation);

        // 使用纹理
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.uniform1i(gl.getUniformLocation(this.program, 'u_texture'), 0);

        // 设置投影矩阵
        gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'projmatrix'), false, cam.vpm);

        // 绘制背景球
        const vertexCount = this.sphereVertices.length / 3; 
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, vertexCount);

        // 恢复状态
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }
}
