//import * as THREE from './vendor/three/three';
import RenderController from './vendor/leia/RenderController.js';
import BackLightController from './vendor/leia/BackLightController.js';
import { BacklightMode } from './vendor/leia/Constants.js';

var container = null;
var camera = null;
var renderer = null;
var scene = null;
var cameras = [];
var renderTarget = null;
var origRT = null;
var inLightfieldMode = false;
var inFullscreenMode = false;
var controller = null;

function init() 
{
    
    if (document.addEventListener)
    {
        document.addEventListener('webkitfullscreenchange', OnChangeFullscreen, false);
        document.addEventListener('mozfullscreenchange', OnChangeFullscreen, false);
        document.addEventListener('fullscreenchange', OnChangeFullscreen, false);
        document.addEventListener('MSFullscreenChange', OnChangeFullscreen, false);
    }

    container = document.querySelector('#scene-container');

    // ensure pixel perfect scaling for different display settings
    document.querySelector("meta[name=viewport]").
        setAttribute('content', 'initial-scale=' +
            (1.0/window.devicePixelRatio) + ', minimum-scale=0.01, user-scalable=0');
           
    //
    const canvas = document.querySelector('#hiddenCanvas'); // for three.js
    const mainCanvas = document.querySelector("#myCanvas"); // for leia webgl sdk
 
    //
    var gl = mainCanvas.getContext("webgl", { preserveDrawingBuffer : true });
    controller = RenderController;
    controller.initialize(mainCanvas, gl, window);
    controller.setConvergence(10);
    controller.setupCanvas(gl);
    var rtWidth = controller.getRenderTextureWidth();
    var rtHeight = controller.getRenderTextureHeight();
    renderTarget = new THREE.WebGLRenderTarget(rtWidth,rtHeight);
    
    var cameraPositions = controller.getCameraPositions();
    for (var i = 0 ; i < cameraPositions.length ; i++)
    {
        const newcamera = new THREE.PerspectiveCamera(60, rtWidth/rtHeight, 0.1, 100);
         newcamera.position.set(cameraPositions[i], 0, 10);
         cameras.push(newcamera);
    }

    screen.orientation.addEventListener("change", function(e) {
        controller.adaptToOrientation(screen.orientation.type);
        updateProjMats(controller);
        }, false);


    controller.adaptToOrientation(screen.orientation.type);
    updateProjMats(controller);
    controller.setupTextures(gl, rtWidth, rtHeight);
    
    // create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color("rgb(0, 128, 256)");

    // Create camera
    camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 10);

    // Create light
    const ambientLight = new THREE.HemisphereLight(0xddeeff, 0x200020, 3, );
    scene.add(ambientLight);

    // Create mesh.
    const geometry = new THREE.BoxBufferGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0x80f880 });
    var mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Create renderer.
    renderer = new THREE.WebGLRenderer();//({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    //renderer.gammaFactor = 2.2;
    //renderer.gammaOutput = true;
    renderer.physicallyCorrectLights = true;
    container.appendChild(renderer.domElement);

    // Get original rendertarget.
    origRT = renderer.getRenderTarget();

    var tempBuffer = new Uint8Array(rtWidth * rtHeight * 4);

    // Start the animation loop
    renderer.setAnimationLoop(() => 
    {
        update(mesh);
        render(tempBuffer, gl, controller, rtWidth, rtHeight);
    });
}

function updateProjMats(controller)
{
    let projectionMatrices = controller.getProjectionMatrices("perspective");
    for (let i = 0; i < projectionMatrices.length; i++) {
        let matrix = new THREE.Matrix4();
        matrix.elements = projectionMatrices[i];
        cameras[i].projectionMatrix = matrix.clone();
        cameras[i].projectionMatrixInverse = matrix.clone();
        cameras[i].projectionMatrixInverse.getInverse(matrix.clone());
    }
}



// Perform any updates to the scene, called once per frame.
function update(mesh)
 {
    // Increase the mesh's rotation each frame
    mesh.rotation.z += 0.01;
    mesh.rotation.x += 0.01;
    mesh.rotation.y += 0.01;
}

var prevCanvasStyleWidth;
var prevCanvasStyleHeight;

function openFullscreen() 
{
    if(!inFullscreenMode)
    {
        var elem = document.getElementById("myCanvas");

        if (elem.requestFullscreen)
            elem.requestFullscreen();
        else if (elem.mozRequestFullScreen) // Firefox
            elem.mozRequestFullScreen();
        else if (elem.webkitRequestFullscreen) // Chrome, Safari & Opera
            elem.webkitRequestFullscreen();
        else if (elem.msRequestFullscreen) // IE/Edge
            elem.msRequestFullscreen();
        
        prevCanvasStyleWidth = elem.style.width;
        prevCanvasStyleHeight = elem.style.height;

        elem.style.width = '100%';
        elem.style.height = '100%';
    }
}

function exitFullscreen()
{
    if(inFullscreenMode)
    {
        var elem = document.getElementById("myCanvas");

        if(document.exitFullscreen)
            document.exitFullscreen();
        else if(document.mozCancelFullScreen) // Firefox
            document.mozCancelFullScreen();
        else if(document.webkitExitFullscreen) // Chrome, Safari & Opera
            document.webkitExitFullscreen();
        else if(document.msExitFullscreen) // IE/Edge
            document.msExitFullscreen();
        
        elem.style.width = prevCanvasStyleWidth
        elem.style.height = prevCanvasStyleHeight;
    }
}

function onEnterFullscreen()
{
    // Add code to handle entering fullscreen.
}

function onExitFullscreen()
{
   // Add code to handle exiting fullscreen.
}

function OnChangeFullscreen()
{
    if (document.webkitIsFullScreen || document.mozFullScreen || document.msFullscreenElement !== undefined) 
    {
        // Entered fullscreen.
        onEnterFullscreen();
    } 
    else 
    {
        // Exited fullscreen.
        onExitFullscreen();
    }
}

function render(tempBuffer, gl, controller, rtWidth, rtHeight) 
{
    if(inLightfieldMode)
    {
        cameras.forEach((curcam,index) => 
        {
            // Render.
            renderer.clear();
            //renderer.setRenderTarget(renderTarget);
            renderer.render(scene, curcam);

            // Readback rendertarget into temporary buffer.
            renderer.readRenderTargetPixels(renderTarget, 0, 0, rtWidth, rtHeight, tempBuffer);

            // Send temporary buffer to controller.
            controller.saveTexture(tempBuffer, index, rtWidth, rtHeight, gl);
        });
    
        // Performs interlacing and sharpening.
        controller.update(gl);
    }
    else
    {
        // Non-lightfield rendering.
        renderer.clear();
        renderer.render(scene, camera);
    }
}

function onWindowResize() 
{
    const canvas = renderer.domElement;
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    //
    camera.aspect = width/height;
    camera.updateProjectionMatrix();

    updateProjMats(controller);

    //
    cameras.forEach((curcam,index) => {
        curcam.aspect = width/height;
        curcam.updateProjectionMatrix();
    });

    //
    renderer.setSize(width, height);
}

var pass=0;
function onMouseDown()
{
    if(pass == 0)
    {
        openFullscreen();
        pass++;
    }
    else
    {
        exitFullscreen();
        pass = 0;
    }
    return;

    if(!inLightfieldMode)
    {
        // Windowed lightfield mode.
        BackLightController.requestBacklightMode(BacklightMode.ON);

        renderer.setRenderTarget(renderTarget);

        if(renderer.domElement.parentNode)
            renderer.domElement.parentNode.removeChild(renderer.domElement);

        inLightfieldMode = true;
    }
    else if(!inFullscreenMode)
    {
        inLightfieldMode = false;

        BackLightController.requestBacklightMode(BacklightMode.OFF);

        renderer.setRenderTarget(origRT);

        if(renderer.domElement.parentNode == null)
            container.appendChild(renderer.domElement);

            openFullscreen();

        BackLightController.requestBacklightMode(BacklightMode.ON);

        renderer.setRenderTarget(renderTarget);

        if(renderer.domElement.parentNode)
            renderer.domElement.parentNode.removeChild(renderer.domElement);

            inLightfieldMode = true;

        /*if(pass==0)
        {
            BackLightController.requestBacklightMode(BacklightMode.OFF);
            pass++;
        }else if(pass==1){
        // Fullscreen lightfield mode.
        //BackLightController.requestBacklightMode(BacklightMode.OFF);
        openFullscreen();
        //BackLightController.requestBacklightMode(BacklightMode.ON);
        //inFullscreenMode = true;
        pass++;
        }
        else if(pass==2)
        {
            BackLightController.requestBacklightMode(BacklightMode.ON);
            inFullscreenMode = true;
            pass=0;
        }*/
    }
    else
    {
        // Windowed 2D mode.
        exitFullscreen();
        inLightfieldMode = false;
        inFullscreenMode = false;
    }

    /*if(inLightfieldMode)
    {
        BackLightController.requestBacklightMode(BacklightMode.ON);

        renderer.setRenderTarget(renderTarget);

        if(renderer.domElement.parentNode)
            renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
    else
    {
        BackLightController.requestBacklightMode(BacklightMode.OFF);

        renderer.setRenderTarget(origRT);

        if(renderer.domElement.parentNode == null)
            container.appendChild(renderer.domElement);
    }*/
}

//
window.addEventListener('resize', onWindowResize);
window.addEventListener('mousedown', onMouseDown);
init();