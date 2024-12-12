const SORTING_ALGORITHMS = [
    'count sort',
    'quick sort',
    'Array.sort'
]

let maxGaussianController = null
let camController = {
    texts: {
        'default': 'When in calibration mode, you can click on 3 points in your scene to define the ground and orientate the camera accordingly.',
        'calibrating': 'Click on 3 points in your scene to define a plane.',
        'calibrated': 'Click on Apply to orientate the camera so that the defined plane is parallel to the ground.'
    }
}

// Init settings GUI panel
function initGUI() {
    const gui = new lil.GUI({title: 'Settings'})

    // 修改面板的背景色
    gui.domElement.style.backgroundColor = '#222';
    gui.domElement.style.fontFamily =   'sans-serif','Oswald' , 'Orbitron';

    // 将面板固定在页面底部  
    //gui.domElement.style.left = '100px';    // 定位到页面的左侧 
    //#gui.domElement.style.top = '50px';    // 定位到页面的左侧 



    // Main settings
    const sceneNames = Object.entries(defaultCameraParameters).map(([name, { size }]) => `${name} (${size})`)
    settings.scene = sceneNames[0]
    gui.add(settings, 'scene', sceneNames).name('Scene').listen()
       .onChange((scene) => loadScene({ scene }))

    gui.add(settings, 'renderResolution', 0.1, 1, 0.01).name('Preview Resolution')

    maxGaussianController = gui.add(settings, 'maxGaussians', 1, settings.maxGaussians, 1).name('Max Gaussians')
       .onChange(() => {
            cam.needsWorkerUpdate = true
            cam.updateWorker()
        })

    gui.add(settings, 'scalingModifier', 0.01, 1, 0.01).name('Scaling Modifier')
        .onChange(() => requestRender())

    // File upload handler
    gui.add(settings, 'uploadFile').name('Upload .ply file')
    document.querySelector('#input').addEventListener('change', async e => {
        if (e.target.files.length === 0) return
        try {
            await loadScene({ file: e.target.files[0] })
        } catch (error) {
            document.querySelector('#loading-text').textContent = `An error occured when trying to read the file.`
            throw error
        }
    })

    // Other settings
    const otherFolder = gui.addFolder('Other Settings').close()

    otherFolder.add(settings, 'sortingAlgorithm', SORTING_ALGORITHMS).name('Sorting Algorithm')

    otherFolder.add(settings, 'sortTime').name('Sort Time').disable().listen()

    otherFolder.addColor(settings, 'bgColor').name('Background Color')
       .onChange(value => {
        document.body.style.backgroundColor = value
        requestRender()
    })

    otherFolder.add(settings, 'speed', 0.01, 2, 0.01).name('Camera Speed')

    otherFolder.add(settings, 'fov', 30, 110, 1).name('FOV')
       .onChange(value => {
        cam.fov_y = value * Math.PI / 180
        requestRender()
    })

    otherFolder.add(settings, 'debugDepth').name('Show Depth Map')
       .onChange(() => requestRender())

    // Camera calibration folder
    addCameraCalibrationFolder(gui)

    // Camera controls folder
    addControlsFolder(gui)
     
}

function addCameraCalibrationFolder(gui) {
    const folder = gui.addFolder('Camera Calibration').close()
    const p = document.createElement('p')
    p.className = 'controller'
    p.textContent = camController.texts['default']

    camController.p = p

    camController.resetCalibration = () => {
        cam.resetCalibration()
        camController.finish.disable()
        camController.start.name('Start Calibration')
        camController.start.updateDisplay()
        p.textContent = camController.texts['default']
    }

    camController.start = folder.add(settings, 'calibrateCamera').name('Start Calibration')
        .onChange(() => {
            if (cam.isCalibrating) {
                camController.resetCalibration()
                requestRender()
            }
            else {
                cam.isCalibrating = true
                camController.start.name('Abort Calibration')
                camController.start.updateDisplay()
                p.textContent = camController.texts['calibrating']
            }
        })

    camController.finish = folder.add(settings, 'finishCalibration').name('Apply changes').disable()
        .onChange(() => {
            cam.isCalibrating = false
            cam.finishCalibration()

            camController.finish.disable()
            camController.start.name('Calibrate Camera')
            camController.start.updateDisplay()
            camController.showGizmo.show()
            p.textContent = camController.texts['default']
        })

    camController.showGizmo = folder.add(settings, 'showGizmo').name('Show Plane').hide()
        .onChange(() => requestRender())

    // Camera calibration text info
    folder.children[0].domElement.parentNode.insertBefore(p, folder.children[0].domElement)
}

function addControlsFolder(gui) {
    const controlsFolder = gui.addFolder('Controls')
    controlsFolder.add(settings, 'freeFly').name('Free Flying').listen()
       .onChange(value => {
            cam.freeFly = value
            requestRender()
        })

    // Free-fly text info
    const controlsHelp = document.createElement('div')
    controlsHelp.style.padding = '4px'
    controlsHelp.style.lineHeight = '1.2'
    controlsHelp.innerHTML = `
        <u>Freefly controls:</u><br>
        <span class='ctrl-key'>WASD, ZQSD</span>: forward/left/backward/right <br>
        <span class='ctrl-key'>Shift/Space</span>: move down/up <br>
        <br>
        <u>Orbit controls:</u><br>
        <span class='ctrl-key'>Left click + drag</span>: rotate around target <br>
        <span class='ctrl-key'>Mouse wheel</span>: zoom in/out
    `
    controlsFolder.domElement.lastChild.appendChild(controlsHelp)
}
 