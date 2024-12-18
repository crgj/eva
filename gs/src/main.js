let gl, program
let cam = null
let worker = null
let isWorkerSorting = false
let canvasSize = [0, 0]

let renderFrameRequest = null
let renderTimeout = null

let gaussianCount
let sceneMin, sceneMax

let backgroundRenderer=new BackgroundRenderer()
let gizmoRenderer = new GizmoRenderer()
let positionBuffer, positionData, opacityData
 

 

const settings = {
    scene: 'room',
    renderResolution: 0.5,
    maxGaussians: 1e6,
    scalingModifier: 1,
    sortingAlgorithm: 'count sort',
    bgColor: '#000000',
    speed: 0.07,
    fov: 47,
    debugDepth: false,
    freeFly: false,
    sortTime: 'NaN',
    uploadFile: () => document.querySelector('#input').click(),

    // Camera calibration
    calibrateCamera: () => {},
    finishCalibration: () => {},
    showGizmo: true
}

const defaultCameraParameters = {
    'room': {
        up: [0, 1, 0],
        target: [0, 0, 0],
        camera: [Math.PI/4, -Math.PI/2, 0.01],
        defaultCameraMode: 'freefly',
        size: '270mb'
    } ,
    'room1': {
        up: [0, 1, 0],
        target: [0, 0, 0],
        camera: [Math.PI/4, Math.PI/2, 0.01],
        defaultCameraMode: 'freefly',
        size: '270mb'
    } 
}

async function main() {
    // Setup webgl context and buffers
    const { glContext, glProgram, buffers } = await setupWebglContext()
    gl = glContext; program = glProgram // Handy global vars

    if (gl == null || program == null) {
        document.querySelector('#loading-text').style.color = `red`
        document.querySelector('#loading-text').textContent = `Could not initialize the WebGL context.`
        throw new Error('Could not initialize WebGL')
    }

    // 创建多线程worker
    // Setup web worker for multi-threaded sorting
    worker = new Worker('./gs/src/worker-sort.js')

    //设置onmessage的回调函数，主线程执行
    // Event that receives sorted gaussian data from the worker
    worker.onmessage = e => {
        const { data, sortTime } = e.data

        if (getComputedStyle(document.querySelector('#loading-container')).opacity != 0) { 
            setTimeout(() => {
                document.querySelector('#loading-container').style.opacity = 0;
                cam.disableMovement = false;
            }, 3000); // 等待3秒 (1000毫秒)
        }

        const updateBuffer = (buffer, data) => {
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
            gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW)
        }

        updateBuffer(buffers.color, data.colors)
        updateBuffer(buffers.center, data.positions)
        updateBuffer(buffers.opacity, data.opacities)
        updateBuffer(buffers.covA, data.cov3Da)
        updateBuffer(buffers.covB, data.cov3Db)

        // Needed for the gizmo renderer
        positionBuffer = buffers.center
        positionData = data.positions
        opacityData = data.opacities

        settings.sortTime = sortTime

        isWorkerSorting = false
        requestRender()
    }

    // Setup GUI
    initGUI()

    // Setup gizmo renderer
    await gizmoRenderer.init()
    await backgroundRenderer.init()
    
    // Load the default scene
    await loadScene({ scene: settings.scene })
}

// Load a .ply scene specified as a name (URL fetch) or local file
async function loadScene({scene, file}) {
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    if (cam) cam.disableMovement = true
    document.querySelector('#loading-container').style.opacity = 1

    let reader, contentLength

    // Create a StreamableReader from a URL Response object
    if (scene != null) {
        scene = scene.split('(')[0].trim()
        //const url = `https://huggingface.co/kishimisu/3d-gaussian-splatting-webgl/resolve/main/${scene}.ply`
        
        
        const url = `ply/panda.ply`
        const response = await fetch(url)
        contentLength = parseInt(response.headers.get('content-length'))
        reader = response.body.getReader()
    }
    // Create a StreamableReader from a File object
    else if (file != null) {
        contentLength = file.size
        reader = file.stream().getReader()
        settings.scene = 'custom'
    }
    else
        throw new Error('No scene or file specified')

    // Download .ply file and monitor the progress
    const content = await downloadPly(reader, contentLength)

    // Load and pre-process gaussian data from .ply file
    const data = await loadPly(content.buffer)

    // Send gaussian data to the worker
    worker.postMessage({ gaussians: {
        ...data, count: gaussianCount
    } })

    // Setup camera
    const cameraParameters = scene ? defaultCameraParameters[scene] : {}
    if (cam == null) cam = new Camera(cameraParameters)
    else cam.setParameters(cameraParameters)

 
    //console.log(cameraParameters)
    //1设置摄像机位置

 

    cam.setCameraPose(
        [10, 10, 10],          // 摄像机位置
        [0, 0, 0],          // 摄像机注视的目标
        [0, 1, 0]           // 上向量
    );


    cam.update()

    // Update GUI
    settings.maxGaussians = Math.min(settings.maxGaussians, gaussianCount)
    maxGaussianController.max(gaussianCount)
    maxGaussianController.updateDisplay()
}

function requestRender(...params) {
    if (renderFrameRequest != null) 
        cancelAnimationFrame(renderFrameRequest)

    renderFrameRequest = requestAnimationFrame(() => render(...params)) 
}
 
// Render a frame on the canvas
function render(width, height, res) {
    // Update canvas size
    const resolution = res ?? settings.renderResolution
    const canvasWidth = width ?? Math.round(canvasSize[0] * resolution)
    const canvasHeight = height ?? Math.round(canvasSize[1] * resolution)

    if (gl.canvas.width != canvasWidth || gl.canvas.height != canvasHeight) {
        gl.canvas.width = canvasWidth
        gl.canvas.height = canvasHeight
    }

    // Update camera
    cam.update()

    

    // Setup viewport
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    gl.enable(gl.DEPTH_TEST);  // 启用深度测试
    gl.depthFunc(gl.LESS);     // 设置深度测试的函数，LESS 表示渲染深度较小的物体
   
    gl.useProgram(program)


    

    

    
    // Original implementation parameters
    const W = gl.canvas.width
    const H = gl.canvas.height
    const tan_fovy = Math.tan(cam.fov_y * 0.5)
    const tan_fovx = tan_fovy * W / H
    const focal_y = H / (2 * tan_fovy)
    const focal_x = W / (2 * tan_fovx)

    gl.uniform1f(gl.getUniformLocation(program, 'W'), W)
    gl.uniform1f(gl.getUniformLocation(program, 'H'), H)
    gl.uniform1f(gl.getUniformLocation(program, 'focal_x'), focal_x)
    gl.uniform1f(gl.getUniformLocation(program, 'focal_y'), focal_y)
    gl.uniform1f(gl.getUniformLocation(program, 'tan_fovx'), tan_fovx)
    gl.uniform1f(gl.getUniformLocation(program, 'tan_fovy'), tan_fovy)
    gl.uniform1f(gl.getUniformLocation(program, 'scale_modifier'), settings.scalingModifier)
    gl.uniform3fv(gl.getUniformLocation(program, 'boxmin'), sceneMin)
    gl.uniform3fv(gl.getUniformLocation(program, 'boxmax'), sceneMax)
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'projmatrix'), false, cam.vpm)
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'viewmatrix'), false, cam.vm)

    // Custom parameters
    gl.uniform1i(gl.getUniformLocation(program, 'show_depth_map'), settings.debugDepth)

    //===================================================================================
    // Draw 
    //第一次渲染，不写入深度
    gl.depthMask(false); // 禁用深度写入
    // 渲染透明物体
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, settings.maxGaussians);
    

    //第二次渲染，写入深度
    gl.depthMask(true);  // 恢复深度写入
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, settings.maxGaussians)
    //===================================================================================
 

    
    // Draw gizmo
    
    //gl.depthMask(true);  // 恢复深度写入

    gizmoRenderer.render()

    
    //backgroundRenderer.render()





    renderFrameRequest = null

    // Progressively draw with higher resolution after the camera stops moving
    let nextResolution = Math.floor(resolution * 4 + 1) / 4
    if (nextResolution - resolution < 0.1) nextResolution += .25

    if (nextResolution <= 1 && !cam.needsWorkerUpdate && !isWorkerSorting) {
        const nextWidth = Math.round(canvasSize[0] * nextResolution)
        const nextHeight = Math.round(canvasSize[1] * nextResolution)

        if (renderTimeout != null) 
            clearTimeout(renderTimeout)

        renderTimeout = setTimeout(() => requestRender(nextWidth, nextHeight, nextResolution), 200)
    }
}

window.onload = main
