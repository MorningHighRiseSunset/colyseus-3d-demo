const DEBUG = false;
import * as THREE from './libs/three.module.js';
import {
    GLTFLoader
} from './libs/GLTFLoader.js';
import {
    OrbitControls
} from './libs/OrbitControls.js';
import {
    TextGeometry
} from './libs/TextGeometry.js';
import {
    FontLoader
} from './libs/FontLoader.js';
import {
    CatmullRomCurve3
} from './libs/three.module.js';

// Initialize the GLTFLoader
const loader = new GLTFLoader();

// Register the KHR_materials_pbrSpecularGlossiness extension
class GLTFMaterialsPbrSpecularGlossinessExtension {
    constructor(parser) {
        this.parser = parser;
    }
    
    afterRoot(result) {
        return Promise.all(result.materials.map((materialDef, index) => {
            if (materialDef.extensions && materialDef.extensions.KHR_materials_pbrSpecularGlossiness) {
                return this.assignMaterial(materialDef, index);
            }
            return Promise.resolve();
        }));
    }
    
    assignMaterial(materialDef, index) {
        const material = this.parser.materials[index];
        if (!material) return Promise.resolve();
        
        const pbrSpecularGlossiness = materialDef.extensions.KHR_materials_pbrSpecularGlossiness;
        
        // Convert specular-glossiness to metallic-roughness
        if (pbrSpecularGlossiness.diffuseFactor) {
            material.color.fromArray(pbrSpecularGlossiness.diffuseFactor);
        }
        
        if (pbrSpecularGlossiness.specularFactor) {
            const specular = pbrSpecularGlossiness.specularFactor;
            material.metalness = 1 - Math.max(specular[0], specular[1], specular[2]);
        }
        
        if (pbrSpecularGlossiness.glossinessFactor !== undefined) {
            material.roughness = 1 - pbrSpecularGlossiness.glossinessFactor;
        }
        
        return Promise.resolve();
    }
}

loader.register((parser) => new GLTFMaterialsPbrSpecularGlossinessExtension(parser));

let camera, scene, renderer, controls;
const clock = new THREE.Clock();

let currentPlayerIndex = 0;
let players = [
    { name: "Player 1", money: 5000, properties: [], selectedToken: null, currentPosition: 0 },
    { name: "Player 2", money: 5000, properties: [], selectedToken: null, currentPosition: 0 },
    { name: "Player 3", money: 5000, properties: [], selectedToken: null, currentPosition: 0 },
    { name: "Player 4", money: 5000, properties: [], selectedToken: null, currentPosition: 0 }
];

let selectedToken = null;
let tokenSelectionUI = null;
let popupGroup;
let raycaster, mouse;

let aiPlayers = new Set();
let aiPlayerIndices = [];
let initialSelectionComplete = false;
let humanPlayerCount = 0;

let allowedToRoll = true;
let isTurnInProgress = false;
let isTokenMoving = false;
let isAIProcessing = false;
let hasTakenAction = false;
let hasDrawnCard = false;
let hasRolledDice = false;
let hasMovedToken = false;
let hasHandledProperty = false;
let turnCounter = 0;
let lastPlayerIndex = -1;

let cameraFollowMode = true; // Start with camera following token
let userIsMovingCamera = false;

let idleModel, walkModel;
let idleMixer, walkMixer;
let currentAnimation = null;
let rollsRoyceIdleAnim = null;
let helicopterHoverAnim = null;
let currentlyMovingToken = null;
let hatIdleAnim = null;
let nikeIdleAnim = null;
let footballIdleAnim = null;
let burgerIdleAnim = null;

let followCamera; // For secondary camera if used
let idleCameraAngle = 0, idleCameraRadius = 38, idleCameraHeight = 18;
let idleCameraTarget = new THREE.Vector3(0, 0, 0);
let lastCameraMode = null;

let propertyOptionsUI = null;
let gameStarted = false;
let diceContainer = null;

let editMode = false;
let draggedObject = null;
let isPopupVisible = false;

// ===== MULTIPLAYER SYSTEM =====
// Multiplayer state variables
let isMultiplayerMode = false;
let multiplayerGame = null;
let currentPlayerId = null;
let currentRoomId = null;

// ===== VIDEO CHAT SYSTEM =====
// Video Chat State Variables - Declare at top level
let videoChat = null;
let localStream = null;
let peerConnection = null;
let isVideoEnabled = true;
let isAudioEnabled = true;
let isMinimized = false;
let videoChatActive = false;
let videoBoxes = []; // Array to store all video boxes
let currentPlayerCount = 0; // Track current number of players

// Video Chat Elements - Declare at top level
let videoChatToggleBtn = null;
let videoChatContainer = null;
let videoGrid = null;
let toggleVideoBtn = null;
let toggleAudioBtn = null;
let leaveBtn = null;
let minimizeBtn = null;
let videoStatus = null;

// --- Audio ---
let accelerationSound = new Audio('Sounds/Rolls-Royce-Audio.mp3'); // Rolls Royce movement sound
accelerationSound.preload = 'auto';
accelerationSound.load();

let helicopterSound = new Audio('Sounds/helicopter-rotor-sound-effectpart-2-95798.mp3');
helicopterSound.loop = true;
helicopterSound.volume = 0.7;

// Helicopter audio control functions
function pauseHelicopterAudio() {
    // Only pause helicopter audio if it's currently playing
    if (helicopterSound && !helicopterSound.paused) {
        helicopterSound.pause();
    }
}

function resumeHelicopterAudio() {
    // Only resume helicopter audio if a helicopter token is currently being used
    const currentPlayer = players[currentPlayerIndex];
    if (currentPlayer && currentPlayer.selectedToken && 
        currentPlayer.selectedToken.userData.tokenName === "helicopter" &&
        helicopterSound && helicopterSound.paused) {
        helicopterSound.play().catch(error => console.error("Failed to resume helicopter audio:", error));
    }
}

let horseGallopingSound = new Audio('Sounds/horses-galloping-sound-effect-359257.mp3');
horseGallopingSound.volume = 0.6;

window.addEventListener('mousedown', onMouseDown);
window.addEventListener('mousemove', onMouseMove);
window.addEventListener('mouseup', onMouseUp);

function getCurrentPlayerToken() {
    const currentPlayer = players[currentPlayerIndex];
    if (!currentPlayer) return null;
    const token = currentPlayer.selectedToken;
    if (token && token.parent && token.visible) return token;
    if (DEBUG) {
        console.warn('[CameraFollow] No valid token for player', currentPlayerIndex, currentPlayer);
    }
    return null;
}

function updateCameraFollowUI() {
    const btn = document.getElementById('camera-follow-toggle');
    const indicator = document.getElementById('camera-follow-indicator');
    if (btn) btn.innerText = cameraFollowMode ? 'Unfollow Token (F)' : 'Follow Token (F)';
    if (btn) btn.style.background = cameraFollowMode ? '#4caf50' : '#222';
    if (indicator) indicator.style.display = cameraFollowMode ? 'block' : 'none';
}

function toggleCameraFollowMode() {
    cameraFollowMode = !cameraFollowMode;
    updateCameraFollowUI();
    console.log('Camera follow mode:', cameraFollowMode);
}

window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyF') {
        console.log('F key pressed');
        toggleCameraFollowMode();
    }
});

const images = [
    "Images/p-las-vegas-motor-speedway_55_660x440_201404181828.webp", // Grand Prix
    "https://s3-us-west-1.amazonaws.com/exr-static/upload/vegassupercars/off_road/track_overview/gallery/SV_OFF_ROAD_TRACK_GALLERY_7.jpg", // Speed Vegas Off Roading
    "Images/230613231941-04-knights-stanley-cup-061323.jpg", // Las Vegas Golden Knights
    // Las Vegas Monorail
    "Images/702-helicopters.webp", // Maverick Helicopter Rides
    // Brothel
    "Images/693695_050215-ap-mayweather-img.jpg",
    //"Images/Screenshot 2024-12-12 033702.png", 
    "", // Brothel
    "Images/1.png", // Luxury Tax
    // Bellagio
    "Images/11929141633_b4ab5fd45e_k.webp", // Horseback Riding
    "Images/raidersimage.png", // Las Vegas Raiders
    "https://s.abcnews.com/images/Sports/las-vegas-aces-gty-thg-180808_hpMain_16x9_992.jpg", // Las Vegas Aces
    "", // Resorts World Theatre
    "Images/themirage.jpg", // Mirage
    "Images/unnamed.png",
    "Images/berry1.webp", // Nascar
    "https://upload.wikimedia.org/wikipedia/commons/c/c1/Wynn_2_%282%29.jpg", // Wynn Las Vegas
    "Images/unnamed (1).png",
    "https://shrinerschildrensopen.com/wp-content/uploads/2022/10/ShrinersChildrens-18-hole-2022.jpg", // Shriners Children's Open
    "Images/bachelor-party.jpg", // Bachelor & Bachelorette Parties
    "Images/Las+Vegas+Elopement+Wedding+Champagne+Pop.webp", // Las Vegas Little White Wedding Chapel
    "Images/thesphere.jpg", // Sphere
    "Images/welcome-to-caesars-palace.jpg", // Caesars Palace
    "Images/hq720.jpg", // Santa Fe Hotel and Casino
    "Images/house-of-blues.jpg", // House of Blues
    "Images/cosmopolitan.jpg", // Cosmopolitan
    "Images/monorail.jpg", // Las Vegas Monorail (position 38)
    "Images/speed-vegas.jpg", // Speed Vegas Off Roading (position 39)
    "Images/chance-card.jpg", // Chance (position 40)
    "Images/golden-knights.jpg" // Las Vegas Golden Knights (position 41)
];

const ticketProperties = [
    "Las Vegas Grand Prix",
    "Las Vegas Golden Knights",
    "Las Vegas Raiders",
    "Las Vegas Aces",
    "Horseback Riding",
    "Maverick Helicopter Rides",
    "Sphere",
    "Shriners Children's Open",
    "Las Vegas Little White Wedding Chapel",
    "Resorts World Theatre",
    "House of Blues",
    "Bet MGM",
    "Las Vegas Monorail",
    "Speed Vegas Off Roading",
    "Las Vegas Monorail", // Additional railroad
    "Speed Vegas Off Roading", // Additional property
    "Las Vegas Golden Knights" // Additional property
];

const positions = [{
        x: 32.4,
        y: 1.5,
        z: 32.4
    }, // GO (Bottom Right Corner)
    {
        x: 25.2,
        y: 1.5,
        z: 32.4
    },
    {
        x: 18,
        y: 1.5,
        z: 32.4
    },
    {
        x: 10.8,
        y: 1.5,
        z: 32.4
    },
    {
        x: 3.6,
        y: 1.5,
        z: 32.4
    },
    {
        x: -3.6,
        y: 1.5,
        z: 32.4
    },
    {
        x: -10.8,
        y: 1.5,
        z: 32.4
    },
    {
        x: -18,
        y: 1.5,
        z: 32.4
    },
    {
        x: -25.2,
        y: 1.5,
        z: 32.4
    },
    {
        x: -32.4,
        y: 1.5,
        z: 32.4
    }, // JAIL (Bottom Left Corner)

    {
        x: -32.4,
        y: 1.5,
        z: 25.2
    },
    {
        x: -32.4,
        y: 1.5,
        z: 18
    },
    {
        x: -32.4,
        y: 1.5,
        z: 10.8
    },
    {
        x: -32.4,
        y: 1.5,
        z: 3.6
    },
    {
        x: -32.4,
        y: 1.5,
        z: -3.6
    },
    {
        x: -32.4,
        y: 1.5,
        z: -10.8
    },
    {
        x: -32.4,
        y: 1.5,
        z: -18
    },
    {
        x: -32.4,
        y: 1.5,
        z: -25.2
    },
    {
        x: -32.4,
        y: 1.5,
        z: -32.4
    }, // FREE PARKING (Top Left Corner)

    {
        x: -25.2,
        y: 1.5,
        z: -32.4
    },
    {
        x: -18,
        y: 1.5,
        z: -32.4
    },
    {
        x: -10.8,
        y: 1.5,
        z: -32.4
    },
    {
        x: -3.6,
        y: 1.5,
        z: -32.4
    },
    {
        x: 3.6,
        y: 1.5,
        z: -32.4
    },
    {
        x: 10.8,
        y: 1.5,
        z: -32.4
    },
    {
        x: 18,
        y: 1.5,
        z: -32.4
    },
    {
        x: 25.2,
        y: 1.5,
        z: -32.4
    },
    {
        x: 32.4,
        y: 1.5,
        z: -32.4
    }, // GO TO JAIL (Top Right Corner)

    {
        x: 32.4,
        y: 1.5,
        z: -25.2
    },
    {
        x: 32.4,
        y: 1.5,
        z: -18
    },
    {
        x: 32.4,
        y: 1.5,
        z: -10.8
    },
    {
        x: 32.4,
        y: 1.5,
        z: -3.6
    },
    {
        x: 32.4,
        y: 1.5,
        z: 3.6
    },
    {
        x: 32.4,
        y: 1.5,
        z: 10.8
    },
    {
        x: 32.4,
        y: 1.5,
        z: 18
    },
    {
        x: 32.4,
        y: 1.5,
        z: 25.2
    },
    {
        x: 32.4,
        y: 1.5,
        z: 32.4
    }, // Back to GO (completing the square)
    {
        x: 25.2,
        y: 1.5,
        z: 32.4
    } // Additional position to make it 42 squares
];

const properties = [{
        name: "GO",
        type: "special",
        imageUrls: [],
        description: "Collect $200 as you pass GO!",
        special: true
    },
    {
        name: "Las Vegas Raiders",
        price: 100,
        rent: 10,
        owner: null,
        address: "3333 Al Davis Way, Las Vegas, NV 89118 (Allegiant Stadium)",
        color: "brown",
        mortgageValue: 50,
        housePrice: 50,
        hotelPrice: 250,
        rentWithHouse: [50, 150, 450, 625],
        rentWithHotel: 750,
        videoUrls: [
            "Videos/LVRaidersVid.mp4",
            "Videos/LVRaiders 2 (1).mp4",
            "Videos/LVRaiders 3 (1).mp4",
            "Videos/LVRaiders 4 (1).mp4",
            "Videos/LVRaiders 5 (1).mp4",
        ],
    },
    {
        name: "Community Cards",
        type: "special",
        videoUrls: [],
        description: "Draw a Community Card!",
        special: true
    },
    {
        name: "Las Vegas Grand Prix",
        price: 120,
        rent: 12,
        owner: null,
        address: "7000 Las Vegas Blvd N, Las Vegas, NV 89115 (Las Vegas Motor Speedway)",
        color: "brown",
        mortgageValue: 60,
        housePrice: 50,
        hotelPrice: 250,
        rentWithHouse: [60, 180, 500, 700],
        rentWithHotel: 900,
        videoUrls: [
            "Videos/LV Grand Prix.mp4",
            "Videos/LV Grand Prix End (1).mp4",
        ],
        customBuyLabel: "Buy ticket",
    },
    {
        name: "Income Tax",
        type: "tax",
        price: 200,
        imageUrls: ["Images/Uncle-Sam-1.jpg"],
        description: "Pay Income Tax: $200 or 10% of your total worth",
        special: true
    },
    {
        name: "Las Vegas Monorail",
        price: 200,
        rent: 25,
        owner: null,
        type: "railroad",
        address: "2535 S Las Vegas Blvd, Las Vegas, NV 89109",
        mortgageValue: 100,
        rentWithRailroads: [25, 50, 100, 200],
        videoUrls: ["Videos/Monorail (1).mp4"],
        customBuyLabel: "Buy a ticket",
        noRent: true
    },
    {
        name: "Speed Vegas Off Roading",
        price: 140,
        rent: 14,
        owner: null,
        address: "14200 S Las Vegas Blvd, Las Vegas, NV 89054 (SPEEDVEGAS)",
        color: "lightblue",
        mortgageValue: 70,
        housePrice: 100,
        hotelPrice: 250,
        rentWithHouse: [70, 200, 550, 750],
        rentWithHotel: 950,
        videoUrls: ["Videos/Offroading 1 (1).mp4"],
        customBuyLabel: "Rent a dune buggy",
        noRent: true
    },
    {
        name: "Chance",
        type: "special",
        videoUrls: [],
        description: "Draw a Chance card!",
        special: true
    },
    {
        name: "Las Vegas Golden Knights",
        price: 160,
        rent: 16,
        owner: null,
        address: "3780 S Las Vegas Blvd, Las Vegas, NV 89158 (T-Mobile Arena)",
        color: "lightblue",
        mortgageValue: 80,
        housePrice: 100,
        hotelPrice: 250,
        rentWithHouse: [80, 220, 600, 800],
        rentWithHotel: 1000,
        videoUrls: [
            "Videos/LV GKnights 1 (1).mp4",
            "Videos/LV GKnights 2 (1).mp4",
            "Videos/LV Golden Knights (1).mp4",
        ],
        customBuyLabel: "Buy a ticket",
    },
    {
        name: "JAIL",
        price: 100,
        rent: 10,
        owner: null,
        address: "Jail Square",
        color: "gray",
        mortgageValue: 50,
        description: "Pay rent if owned, or just visit if unowned.",
        videoUrls: []
    },
    {
        name: "Maverick Helicopter Rides",
        price: 220,
        rent: 22,
        owner: null,
        address: "6075 S Las Vegas Blvd, Las Vegas, NV 89119",
        color: "pink",
        mortgageValue: 110,
        housePrice: 150,
        hotelPrice: 250,
        rentWithHouse: [110, 330, 800, 975],
        rentWithHotel: 1150,
        videoUrls: [
            "Videos/MavHeli 1.mp4 (1).mp4",
            "Videos/MavHeli 2.mp4 (1).mp4",
            "Videos/MavHeli 3.mp4 (1).mp4",
        ],
        customBuyLabel: "Buy a helicopter ride",
    },
    {
        name: "Brothel",
        price: 1500,
        rent: 300,
        owner: null,
        address: "Nevada Brothel (Fictional)",
        color: "pink",
        mortgageValue: 75,
        housePrice: 100,
        hotelPrice: 250,
        rentWithHouse: [75, 225, 675, 900],
        rentWithHotel: 1100,
        videoUrls: ["Videos/tapDancingWomen.mp4", "Videos/BrothelVid.mp4"],
        customBuyLabel: "Buy 1 night for 1500",
        customRentLabel: "Rent a room for 300",
        noRent: true
    },
    {
        name: "Electric Company",
        price: 150,
        rent: 0,
        owner: null,
        type: "utility",
        mortgageValue: 75,
        description: "If one utility is owned, rent is 4 times amount shown on dice. If both utilities are owned, rent is 10 times amount shown on dice.",
        imageUrls: "Images/yellow light bulb image.jpg",
    },
    {
        name: "Bet MGM",
        price: 2500,
        rent: 200,
        owner: null,
        address: "3799 S Las Vegas Blvd, Las Vegas, NV 89109",
        color: "pink",
        mortgageValue: 140,
        housePrice: 150,
        hotelPrice: 250,
        rentWithHouse: [150, 450, 1000, 1200],
        rentWithHotel: 1400,
        isPenthouse: true,
        videoUrls: [
            "Videos/MGMBoxing 1 (1).mp4",
            "Videos/MGMBoxing 2 (1).mp4",
            "Videos/MGMBoxing 3 (1).mp4",
        ],
        customBuyLabel: "Buy ticket",
    },
    {
        name: "Bellagio",
        price: 2500,
        rent: 200,
        owner: null,
        address: "3600 S Las Vegas Blvd, Las Vegas, NV 89115",
        color: "orange",
        mortgageValue: 150,
        housePrice: 200,
        hotelPrice: 250,
        rentWithHouse: [200, 600, 1400, 1700],
        rentWithHotel: 2000,
        isPenthouse: true,
        videoUrls: [],
        customBuyLabel: "Book a room",
    },
    {
        name: "Community Cards",
        type: "special",
        videoUrls: [],
        description: "Draw a Community Card!",
        special: true
    },
    {
        name: "FREE PARKING",
        type: "special",
        imageUrls: ["Images/free parking-Photoroom.png"],
        description: "Take a break! No fee to park here.",
        special: true
    },
    {
        name: "Horseback Riding",
        price: 340,
        rent: 34,
        owner: null,
        address: "Red Rock Canyon National Conservation Area, Las Vegas, NV",
        color: "orange",
        mortgageValue: 170,
        housePrice: 200,
        hotelPrice: 250,
        rentWithHouse: [220, 650, 1500, 1850],
        rentWithHotel: 2100,
        videoUrls: ["Videos/horse6 (1).mp4"],
        customBuyLabel: "Buy a ticket",
    },
    {
        name: "Chance",
        type: "special",
        videoUrls: [],
        description: "Draw a Chance card!",
        special: true
    },
    {
        name: "Hard Rock Hotel",
        price: 2500,
        rent: 200,
        owner: null,
        address: "3400 S Las Vegas Blvd, Las Vegas, NV 89109",
        color: "red",
        mortgageValue: 200,
        housePrice: 200,
        hotelPrice: 250,
        rentWithHouse: [250, 750, 1600, 1950],
        rentWithHotel: 2200,
        isPenthouse: true,
        videoUrls: [],
    },
    {
        name: "Water Works",
        price: 150,
        rent: 0,
        owner: null,
        type: "utility",
        mortgageValue: 75,
        description: "If one utility is owned, rent is 4 times amount shown on dice. If both utilities are owned, rent is 10 times amount shown on dice.",
        imageUrls: "Images/waterworks.webp",
    },
    {
        name: "Sphere",
        price: 480,
        rent: 0,
        owner: null,
        address: "255 Sands Ave, Las Vegas, NV 89169 (The Sphere)",
        color: "yellow",
        mortgageValue: 240,
        housePrice: 200,
        hotelPrice: 250,
        rentWithHouse: [280, 850, 2000, 2200],
        rentWithHotel: 2400,
        videoUrls: ["Videos/Sphere (1).mp4"],
        customBuyLabel: "Buy a ticket",
        noRent: true
    },
    {
        name: "GO TO JAIL",
        type: "special",
        videoUrls: [],
        description: "Go directly to Jail. Do not pass GO. Do not collect $200.",
        special: true
    },
    {
        name: "Caesars Palace",
        price: 2500,
        rent: 200,
        owner: null,
        address: "3570 S Las Vegas Blvd, Las Vegas, NV 89109",
        color: "green",
        mortgageValue: 250,
        housePrice: 200,
        hotelPrice: 250,
        rentWithHouse: [300, 900, 2200, 2400],
        rentWithHotel: 2600,
        isPenthouse: true,
        videoUrls: [],
    },
    {
        name: "Santa Fe Hotel and Casino",
        price: 2500,
        rent: 200,
        owner: null,
        address: "4949 N Rancho Dr, Las Vegas, NV 89130",
        color: "green",
        mortgageValue: 260,
        housePrice: 200,
        hotelPrice: 250,
        rentWithHouse: [320, 950, 2300, 2500],
        rentWithHotel: 2700,
        isPenthouse: true,
        videoUrls: [],
    },
    {
        name: "Chance",
        type: "special",
        videoUrls: [],
        description: "Draw a Chance card!",
        special: true
    },
    {
        name: "Luxury Tax",
        type: "tax",
        price: 75,
        imageUrls: ["Images/luxuryTax.png"],
        description: "Pay Luxury Tax of $75",
        special: true
    },
    {
        name: "House of Blues",
        price: 2500,
        rent: 200,
        owner: null,
        address: "3950 S Las Vegas Blvd, Las Vegas, NV 89119 (inside Mandalay Bay)",
        color: "blue",
        mortgageValue: 270,
        housePrice: 200,
        hotelPrice: 250,
        rentWithHouse: [330, 1000, 2400, 2600],
        rentWithHotel: 2800,
        isPenthouse: true,
        videoUrls: [],
        customBuyLabel: "Buy a ticket",
    },
    {
        name: "The Cosmopolitan",
        price: 2500,
        rent: 200,
        owner: null,
        address: "3708 S Las Vegas Blvd, Las Vegas, NV 89109",
        color: "blue",
        mortgageValue: 280,
        housePrice: 200,
        hotelPrice: 250,
        rentWithHouse: [350, 1100, 2500, 2700],
        rentWithHotel: 3000,
        isPenthouse: true,
        imageUrls: "",
    },
    {
        name: "Community Cards",
        type: "special",
        videoUrls: [],
        description: "Draw a Community Card!",
        special: true
    },
    {
        name: "Las Vegas Aces",
        price: 320,
        rent: 32,
        owner: null,
        address: "3950 S Las Vegas Blvd, Las Vegas, NV 89119 (Michelob ULTRA Arena)",
        color: "orange",
        mortgageValue: 160,
        housePrice: 200,
        hotelPrice: 250,
        rentWithHouse: [210, 625, 1450, 1750],
        rentWithHotel: 2050,
        videoUrls: [
            "",
            "Videos/WNBA (1).mp4",
            "Videos/WNBAHL2 (1).mp4",
            "Videos/WNBAHL3 (1).mp4",
            "Videos/WNBAHL4 (1).mp4",
        ],
    },
    {
        name: "Resorts World Theatre",
        price: 300,
        rent: 0,
        owner: null,
        address: "3000 S Las Vegas Blvd, Las Vegas, NV 89109 (Resorts World)",
        color: "red",
        mortgageValue: 180,
        housePrice: 200,
        hotelPrice: 250,
        rentWithHouse: [230, 700, 1500, 1850],
        rentWithHotel: 2100,
        videoUrls: [
            "Videos/Eagles_Highlights_Compressed.mp4",
        ],
        customBuyLabel: "Buy a ticket for 300",
        noRent: true
    },
    {
        name: "Wynn Las Vegas",
        price: 2500,
        rent: 200,
        owner: null,
        address: "3131 S Las Vegas Blvd, Las Vegas, NV 89109",
        color: "yellow",
        mortgageValue: 220,
        housePrice: 200,
        hotelPrice: 250,
        rentWithHouse: [260, 800, 1900, 2100],
        rentWithHotel: 2300,
        isPenthouse: true,
        videoUrls: [],
    },
    {
        name: "Shriners Children's Open",
        price: 460,
        rent: 46,
        owner: null,
        address: "",
        color: "yellow",
        mortgageValue: 230,
        housePrice: 200,
        hotelPrice: 250,
        rentWithHouse: [270, 825, 1950, 2150],
        rentWithHotel: 2350,
        videoUrls: [
            "Videos/Shriners 1 (1).mp4",
            "Videos/Shriners 3 (1).mp4",
            "Videos/Shriners 4 (1).mp4",
        ],
    },
    {
        name: "Bachelor & Bachelorette Parties",
        price: 300,
        rent: 30,
        owner: null,
        address: "Various locations across Las Vegas Strip",
        color: "purple",
        mortgageValue: 150,
        housePrice: 150,
        hotelPrice: 300,
        rentWithHouse: [150, 450, 1000, 1800],
        rentWithHotel: 2200,
        imageUrls: ["Images/bachelor-party.jpg"],
        customBuyLabel: "Book a party",
        customRentLabel: "Join the celebration",
        noRent: false
    },
    {
        name: "Las Vegas Little White Wedding Chapel",
        price: 200,
        rent: 20,
        owner: null,
        address: "1301 Las Vegas Blvd S, Las Vegas, NV 89104 (Little White Wedding Chapel)",
        color: "white",
        mortgageValue: 100,
        housePrice: 100,
        hotelPrice: 250,
        rentWithHouse: [100, 300, 900, 1600],
        rentWithHotel: 2500,
        imageUrls: ["Images/Las+Vegas+Elopement+Wedding+Champagne+Pop.webp"],
        customBuyLabel: "Get married",
        customRentLabel: "Renew vows",
        noRent: true
    },
    {
        name: "Las Vegas Monorail",
        price: 200,
        rent: 25,
        owner: null,
        type: "railroad",
        address: "2535 S Las Vegas Blvd, Las Vegas, NV 89109",
        mortgageValue: 100,
        rentWithRailroads: [25, 50, 100, 200],
        videoUrls: ["Videos/Monorail (1).mp4"],
        customBuyLabel: "Buy a ticket",
        noRent: true
    },
    {
        name: "Speed Vegas Off Roading",
        price: 140,
        rent: 14,
        owner: null,
        address: "14200 S Las Vegas Blvd, Las Vegas, NV 89054 (SPEEDVEGAS)",
        color: "lightblue",
        mortgageValue: 70,
        housePrice: 100,
        hotelPrice: 250,
        rentWithHouse: [70, 200, 550, 750],
        rentWithHotel: 950,
        videoUrls: ["Videos/Offroading 1 (1).mp4"],
        customBuyLabel: "Rent a dune buggy",
        noRent: true
    },
    {
        name: "Chance",
        type: "special",
        videoUrls: [],
        description: "Draw a Chance card!",
        special: true
    },
    {
        name: "Speed Vegas Off Roading",
        price: 140,
        rent: 14,
        owner: null,
        address: "14200 S Las Vegas Blvd, Las Vegas, NV 89054 (SPEEDVEGAS)",
        color: "lightblue",
        mortgageValue: 70,
        housePrice: 100,
        hotelPrice: 250,
        rentWithHouse: [70, 200, 550, 750],
        rentWithHotel: 950,
        videoUrls: ["Videos/Offroading 1 (1).mp4"],
        customBuyLabel: "Rent a dune buggy",
        noRent: true
    },
    {
        name: "Las Vegas Golden Knights",
        price: 160,
        rent: 16,
        owner: null,
        address: "3780 S Las Vegas Blvd, Las Vegas, NV 89158 (T-Mobile Arena)",
        color: "lightblue",
        mortgageValue: 80,
        housePrice: 100,
        hotelPrice: 250,
        rentWithHouse: [80, 220, 600, 800],
        rentWithHotel: 1000,
        videoUrls: [
            "Videos/LV GKnights 1 (1).mp4",
            "Videos/LV GKnights 2 (1).mp4",
            "Videos/LV Golden Knights (1).mp4",
        ],
        customBuyLabel: "Buy a ticket"
    }
];


const placeNames = [
    "GO", // Corner 1
    "Las Vegas Raiders",
    "Community Cards", // First Community Cards
    "Las Vegas Grand Prix",
    "Income Tax", // Add Income Tax here
    "Las Vegas Monorail", // First railroad
    "Speed Vegas Off Roading",
    "Chance", // First Chance
    "Las Vegas Golden Knights",
    "JAIL", // Corner 2
    "Maverick Helicopter Rides",
    "Brothel",
    "Electric Company", // First utility
    "Bet MGM",
    "Las Vegas Monorail", // Second railroad
    "Bellagio",
    "Las Vegas Aces",
    "Community Cards", // Second Community Cards
    "FREE PARKING", // Corner 3
    "Horseback Riding",
    "Resorts World Theatre",
    "Chance", // Second Chance
    "Hard Rock hotel", // Changed from "Encore Theatre"
    "Wynn Las Vegas", // Changed from "South Point Casino" 
    "Shriners Children's Open", // Changed from "Golf Inst."
    "Bachelor & Bachelorette Parties",
    "Las Vegas Little White Wedding Chapel",
    "Sphere",
    "Community Cards", // Third Community Cards
    "GO TO JAIL", // Corner 4
    "Caesars Palace",
    "Santa Fe Hotel and Casino", // Changed from "Las Vegas Resort & Casino"
    "Chance", // Third Chance
    "Luxury Tax", // Add Luxury Tax here
    "House of Blues",
    "Water Works", // Second utility
    "The Cosmopolitan",
    "Community Cards", // Fourth Community Cards
    "Las Vegas Monorail", // Fifth railroad
    "Speed Vegas Off Roading", // Position 40
    "Chance", // Fourth Chance
    "Las Vegas Golden Knights" // Position 41
];

const chanceCards = [
    "Move forward 3 spaces",
    "Go back three spaces",
    "Pay $100 for casino renovations", // Increased from $50
    "Collect $300 from a high roller tip", // Increased from $150
    "Your poker face pays off. Collect $150.", // Increased from $75
    "You win a slot machine jackpot. Collect $400.", // Increased from $200
    "Caught cheating at blackjack. Pay $200.", // Increased from $100
    "Casino loyalty program rewards you. Collect $200.", // Increased from $100
    "Your luck runs out. Pay $50.", // Increased from $25
    "Win a casino raffle. Collect $500.", // Increased from $250
    "Pay $200 for a VIP casino membership.", // Increased from $100
    "Collect $100 from each player for hosting a poker night.", // Increased from $50
    "Move forward 5 spaces.",
    "Your lucky day! Collect $600 from the casino.", // Increased from $300
    "Caught counting cards. Pay a $400 fine.", // Increased from $200
    "Win a high-stakes poker game. Collect $1,000.", // Increased from $500
    "Pay $150 for a luxury spa treatment.", // Increased from $75
    "Win a blackjack tournament. Collect $500.", // Increased from $250
    "Caught speeding on the Strip. Pay a $200 fine.", // Increased from $50
    "Your investments pay off. Collect $800." // Increased from $400
];

const communityChestCards = [
    "Advance to GO. Collect $400.", // Increased from $200
    "Get Out of Jail Free - Keep this card until needed or sell it.",
    "Pay $100 for valet parking fees.", // Increased from $50
    "Collect $200 from a casino bonus.", // Increased from $100
    "You win Employee of the Month. Collect $100.", // Increased from $50
    "Pay $300 for a casino uniform upgrade.", // Increased from $150
    "Collect $500 from a casino jackpot.", // Increased from $200
    "Pay $200 for a gaming license renewal.", // Increased from $100
    "Collect $50 from valet parking tips.", // Increased from $25
    "Casino stocks are up. Collect $100.", // Increased from $50
    "Pay $80 per house and $150 per hotel for property maintenance.", // Increased from $40/$115
    "You find a lucky chip on the floor. Collect $50.", // Increased from $20
    "Casino holiday bonus. Collect $150.", // Increased from $75
    "Pay $100 for a casino marketing fee.", // Increased from $50
    "Win a casino poker tournament. Collect $300.", // Increased from $150
    "Casino appreciation day. Collect $50 from each player.", // Increased from $10
    "Caught using your phone at the blackjack table. Pay $100.", // Increased from $50
    "Pay $200 for a charity gala.", // Increased from $100
    "Collect $400 from a casino jackpot.", // Increased from $200
    "You win Employee of the Year. Collect $300.", // Increased from $150
    "Pay $100 for a parking violation.", // Increased from $50
    "Collect $50 from each player for hosting a casino night.", // Increased from $25
    "Move forward 3 spaces.",
    "Pay $80 per house and $150 per hotel for property maintenance.", // Increased from $40/$115
    "Collect $150 from a casino loyalty program.", // Increased from $75
    "You find a winning lottery ticket. Collect $1,000.", // Increased from $500
    "Pay $300 for a luxury suite upgrade.", // Increased from $150
    "Collect $200 for a successful business venture.", // Increased from $100
    "Pay $400 for a luxury shopping spree.", // Increased from $200
    "Your stocks rise. Collect $600.", // Increased from $300
    "Caught cheating at a poker game. Pay $200.", // Increased from $100
    "Advance to the Las Vegas Aces game. If you pass GO, collect $400.", // Increased from $200
    "Win a raffle at the casino. Collect $500.", // Increased from $250
    "Pay $150 for a fine dining experience.", // Increased from $75
    "Collect $100 for a lucky slot machine spin.", // Increased from $50
];

// filepath: c:\Users\DELL\Metropoly\script.js
let availableTokens = [{
        name: "woman",
        displayName: "Woman"
    },
    {
        name: "rolls royce",
        displayName: "Rolls Royce"
    },
    {
        name: "helicopter",
        displayName: "Helicopter"
    },
    {
        name: "hat",
        displayName: "Top Hat"
    },
    {
        name: "football",
        displayName: "Football"
    },
    {
        name: "burger",
        displayName: "Burger"
    },
    {
        name: "nike",
        displayName: "Tennis Shoe"
    }
];

function startTurn() {
    console.log(`Starting turn for Player ${currentPlayerIndex + 1} (${players[currentPlayerIndex].name})`);

    // Reset turn-related flags
    hasDrawnCard = false;

    // Reset property-specific flags
    properties.forEach(property => {
        property.hasBeenHandled = false;
    });

    const currentPlayer = players[currentPlayerIndex];
    if (currentPlayer.isAI) {
        executeAITurn(currentPlayer);
    } else {
        enableHumanTurn(currentPlayer);
    }

    const originalEndTurn = endTurn;
    endTurn = function() {
        originalEndTurn.apply(this, arguments);
        if (cameraFollowMode) {
            setTimeout(() => {
                const currentPlayer = players[currentPlayerIndex];
                if (currentPlayer && currentPlayer.selectedToken) {
                    controls.target.copy(currentPlayer.selectedToken.position);
                    camera.position.lerp(new THREE.Vector3(
                        currentPlayer.selectedToken.position.x + 4,
                        currentPlayer.selectedToken.position.y + 7,
                        currentPlayer.selectedToken.position.z + 4
                    ), 1.0);
                    controls.update();
                }
            }, 400);
        }
    };
    const originalStartTurn = startTurn;
    startTurn = function() {
        originalStartTurn.apply(this, arguments);
        if (cameraFollowMode) {
            setTimeout(() => {
                const currentPlayer = players[currentPlayerIndex];
                if (currentPlayer && currentPlayer.selectedToken) {
                    controls.target.copy(currentPlayer.selectedToken.position);
                    camera.position.lerp(new THREE.Vector3(
                        currentPlayer.selectedToken.position.x + 4,
                        currentPlayer.selectedToken.position.y + 7,
                        currentPlayer.selectedToken.position.z + 4
                    ), 1.0);
                    controls.update();
                }
            }, 400);
        }
    };
}

function toggleAI(token, button) {
    if (!initialSelectionComplete) {
        if (aiPlayers.has(token.name)) {
            // Remove from AI players
            aiPlayers.delete(token.name);
            const indexToRemove = aiPlayerIndices.findIndex(index =>
                players[index].tokenName === token.name
            );
            if (indexToRemove > -1) {
                aiPlayerIndices.splice(indexToRemove, 1);
            }
            button.textContent = "Click to Enable PC";
            button.classList.remove("active");
            button.parentElement.parentElement.querySelector(".ai-indicator").classList.remove("active");
        } else {
            if (humanPlayerCount + aiPlayers.size >= 4) {
                alert("Maximum 4 players allowed!");
                return;
            }

            // Calculate correct player index
            const aiPlayerIndex = humanPlayerCount + aiPlayers.size;

            // Validate player index
            if (aiPlayerIndex >= 4) {
                console.error("Invalid player index:", aiPlayerIndex);
                return;
            }

            console.log(`Setting up AI player ${aiPlayerIndex + 1} with token ${token.name}`);

            // Set up AI player
            const currentPlayer = players[aiPlayerIndex];
            currentPlayer.tokenName = token.name;
            currentPlayer.isAI = true;
            aiPlayerIndices.push(aiPlayerIndex);

            // Use loadedTokenModels for robust assignment
            const selectedTokenObject = window.loadedTokenModels && window.loadedTokenModels[token.name];
            if (selectedTokenObject) {
                currentPlayer.selectedToken = selectedTokenObject;
                selectedTokenObject.visible = true;
                selectedTokenObject.traverse(child => { child.visible = true; });
            }

            aiPlayers.add(token.name);
            button.textContent = "Click to Disable PC";
            button.classList.add("active");
            button.parentElement.parentElement.querySelector(".ai-indicator").classList.add("active");

            // Debug log
            console.log("AI Players after adding:", Array.from(aiPlayers));
            console.log("Player setup:", players.map((p, i) => ({
                index: i,
                tokenName: p.tokenName,
                isAI: p.isAI,
                hasToken: !!p.selectedToken
            })));
        }

        updateStartButtonVisibility();
        
        // Update video chat if it's active
        if (typeof updateVideoChatForGameState === 'function') {
            updateVideoChatForGameState();
        }
    }
}

function updateStartButtonVisibility() {
    const startButton = tokenSelectionUI.querySelector('.action-button');
    const arrowUp = startButton.querySelector('.arrow-flash:nth-child(2)');
    const arrowDown = startButton.querySelector('.arrow-flash:nth-child(3)');
    const count = humanPlayerCount + aiPlayers.size;

    startButton.style.display = "block"; // Always show the button

    if (count >= 2 && count <= 4) {
        startButton.disabled = false;
        startButton.style.opacity = "1";
        startButton.classList.add("flash-active");
        if (arrowUp) arrowUp.style.display = "block";
        if (arrowDown) arrowDown.style.display = "block";
    } else {
        startButton.disabled = true;
        startButton.style.opacity = "0.7";
        startButton.classList.remove("flash-active");
        if (arrowUp) arrowUp.style.display = "none";
        if (arrowDown) arrowDown.style.display = "none";
    }
}

function validatePlayerTokens() {
    players.forEach((player, index) => {
        if (!player.selectedToken && player.tokenName) {
            const tokenObject = scene.children.find(obj =>
                obj.userData.tokenName === player.tokenName
            );
            if (tokenObject) {
                player.selectedToken = tokenObject;
                console.log(`Restored token for player ${index + 1}`);
            }
        }
    });
}

function handleAIPropertyDecision(property, callback = () => {}) {
    if (!property) {
        callback();
        return;
    }
    const currentPlayer = players[currentPlayerIndex];

    if (property.hasBeenHandled) {
        callback();
        return;
    }
    property.hasBeenHandled = true;

    if (property.type === "special") {
        switch (property.name) {
            case "Chance":
            case "Community Cards":
                if (hasDrawnCard) {
                    callback();
                    return;
                }
                showAIPopup(`${currentPlayer.name} draws a ${property.name} card`);
                drawCard(property.name);
                hasDrawnCard = true;
                setTimeout(callback, 1000);
                break;
            default:
                setTimeout(callback, 1000);
        }
    } else if (!property.owner) {
        const shouldBuy = makeAIBuyDecision(currentPlayer, property);
        if (shouldBuy && currentPlayer.money >= property.price) {
            if (ticketProperties.includes(property.name)) {
                showAIPopup(`${currentPlayer.name} buys a ticket for ${property.name} for $${property.price}`);
            } else {
                showAIPopup(`${currentPlayer.name} buys ${property.name} for $${property.price}`);
            }
            buyProperty(currentPlayer, property, callback);
        } else {
            if (ticketProperties.includes(property.name)) {
                showAIPopup(`${currentPlayer.name} skips buying a ticket for ${property.name}`);
            } else {
                showAIPopup(`${currentPlayer.name} skips buying ${property.name}`);
            }
            setTimeout(callback, 1000);
        }
    } else if (property.owner !== currentPlayer) {
        if (!ticketProperties.includes(property.name)) {
            const rentAmount = calculateRent(property);
            if (currentPlayer.money >= rentAmount) {
                showAIPopup(`${currentPlayer.name} pays $${rentAmount} rent to ${property.owner.name}`);
                currentPlayer.money -= rentAmount;
                property.owner.money += rentAmount;
            } else {
                showAIPopup(`${currentPlayer.name} cannot afford rent and is bankrupt!`);
                handleBankruptcy(currentPlayer, property.owner);
            }
        } else {
            // Ticket properties don't charge rent
            showAIPopup(`${currentPlayer.name} visits ${property.name} - no ticket required`);
        }
        setTimeout(callback, 1000);
    } else {
        setTimeout(callback, 1000);
    }
}


function handleRentPayment(player, property) {
    if (!property || !property.owner) {
        console.error("Invalid property or owner for rent payment");
        return;
    }
    // Suppress rent for ticket/concert properties
    if (ticketProperties.includes(property.name)) {
        showFeedback("No rent is due for this property.");
        closePropertyUI();
        setTimeout(() => {
            isTurnInProgress = false;
            endTurn();
        }, 1000);
        return;
    }
    const rentAmount = calculateRent(property);
    if (player.money >= rentAmount) {
        player.money -= rentAmount;
        property.owner.money += rentAmount;
        
        // Check if we're in multiplayer mode
        const isMultiplayer = window.location.search.includes('room=') && window.location.search.includes('player=');
        const isCurrentPlayer = isMultiplayer ? 
            (window.multiplayerGame && (window.multiplayerGame.playerId === player.id || window.multiplayerGame.playerId === player.id?.toString())) : 
            (player === players[currentPlayerIndex]);
        
        // Show feedback to the current player
        showFeedback(`${player.name} paid $${rentAmount} rent to ${property.owner.name}`);
        
        // In multiplayer, show notification to other players
        if (isMultiplayer && !isCurrentPlayer && window.multiplayerGame) {
            window.multiplayerGame.showNotification(
                `${player.name} paid $${rentAmount} rent to ${property.owner.name}`,
                'info'
            );
        }
        
        updateMoneyDisplay();
        closePropertyUI();
        setTimeout(() => {
            isTurnInProgress = false;
            endTurn();
        }, 1500);
    } else {
        showFeedback(`${player.name} cannot afford rent of $${rentAmount}!`);
        handleBankruptcy(player, property.owner);
    }
}


function executeAITurn() {
    const currentPlayer = players[currentPlayerIndex];
    if (!currentPlayer.isAI) {
        console.error(`executeAITurn called for a non-AI player: Player ${currentPlayerIndex + 1}`);
        return;
    }

    console.log(`Executing AI turn for Player ${currentPlayerIndex + 1} (${currentPlayer.name})`);

    isTurnInProgress = true;
    hasRolledDice = false;
    hasMovedToken = false;
    hasHandledProperty = false;
    isAIProcessing = true;

    // Check if AI is in jail first
    if (currentPlayer.inJail) {
        showAIPopup(`${currentPlayer.name} is in Jail and will attempt to get out.`);
        handleAIJailTurn(currentPlayer);
        return;
    }

    setTimeout(() => {
        const roll1 = Math.ceil(Math.random() * 6);
        const roll2 = Math.ceil(Math.random() * 6);
        const diceRoll = roll1 + roll2;

        showAIPopup(`${currentPlayer.name} rolled ${roll1} and ${roll2} (total: ${diceRoll})`);
        showDiceResult(diceRoll, roll1, roll2);
        hasRolledDice = true;

        moveTokenToNewPositionWithCollisionAvoidance(diceRoll, () => {
            hasMovedToken = true;
            const propertyName = placeNames[currentPlayer.currentPosition];
            const property = properties.find(p => p.name === propertyName);

            if (property) {
                showAIPopup(`${currentPlayer.name} landed on ${property.name}`);
                handleAIPropertyLanding(currentPlayer, property, () => {
                    hasHandledProperty = true;
                    checkAITurnCompletion();
                });
            } else {
                hasHandledProperty = true;
                checkAITurnCompletion();
            }
        });
    }, 1000);
}

function handleAIPropertyLanding(player, property, callback) {
    // Play horse galloping sound for Horseback Riding property
    if (property.name === "Horseback Riding") {
        horseGallopingSound.currentTime = 0;
        horseGallopingSound.playbackRate = 0.6; // Slow down for serene effect
        horseGallopingSound.play().catch(() => {});
    }

    switch (property.name) {
        case "Chance":
            console.log("AI landed on Chance.");
            if (!hasDrawnCard) {
                drawCard("Chance");
                hasDrawnCard = true;
            }
            setTimeout(callback, 1500);
            break;

        case "Community Cards":
            console.log("AI landed on Community Cards.");
            if (!hasDrawnCard) {
                drawCard("Community Cards");
                hasDrawnCard = true;
            }
            setTimeout(callback, 1500);
            break;

        case "Income Tax":
            handleAIIncomeTax(player);
            setTimeout(callback, 1500);
            break;

        case "Luxury Tax":
            handleAILuxuryTax(player);
            setTimeout(callback, 1500);
            break;

        case "GO TO JAIL":
            console.log("AI landed on GO TO JAIL");
            goToJail(player);
            setTimeout(callback, 1500);
            break;

        case "JAIL":
            console.log("AI landed on Jail. Just visiting.");
            setTimeout(callback, 1500);
            break;

        case "FREE PARKING":
            console.log("AI landed on Free Parking");
            setTimeout(callback, 1500);
            break;

        default:
            handleAIPropertyDecision(property, callback);
    }
}

function checkAITurnCompletion() {
    console.log("AI Turn Flags:", {
        hasRolledDice,
        hasMovedToken,
        hasHandledProperty,
        hasDrawnCard,
        isTurnInProgress
    });

    if (hasRolledDice && hasMovedToken && hasHandledProperty) {
        setTimeout(() => {
            console.log(`AI turn completed for Player ${currentPlayerIndex + 1}`);
            isTurnInProgress = false;
            isAIProcessing = false;
            endTurn();
        }, 1000);
    } else {
        console.log("AI turn not yet complete. Waiting for all actions to finish.");
    }
}

function handleAIIncomeTax(player) {
    const totalWorth = calculatePlayerWorth(player);
    const tenPercent = Math.floor(totalWorth * 0.1);

    if (tenPercent < 200 && player.money >= tenPercent) {
        showAIPopup(`${player.name} pays $${tenPercent} (10%) in Income Tax`);
        player.money -= tenPercent;
    } else if (player.money >= 200) {
        showAIPopup(`${player.name} pays $200 in Income Tax`);
        player.money -= 200;
    } else {
        showAIPopup(`${player.name} cannot afford Income Tax and is bankrupt!`);
        handleBankruptcy(player, null);
    }
    updateMoneyDisplay();
}

function handleAILuxuryTax(player) {
    if (player.money >= 75) {
        showAIPopup(`${player.name} pays $75 in Luxury Tax`);
        player.money -= 75;
    } else {
        showAIPopup(`${player.name} cannot afford Luxury Tax and is bankrupt!`);
        handleBankruptcy(player, null);
    }
    updateMoneyDisplay();
}

function calculatePlayerWorth(player) {
    let worth = player.money;
    player.properties.forEach(property => {
        worth += property.price || 0;
        worth += (property.houses || 0) * (property.housePrice || 0);
        worth += (property.hotel ? property.hotelPrice : 0);
    });
    return worth;
}

function makeAIPurchaseDecision(player, buyButton) {
    const propertyName = document.querySelector('.detail-value.name').textContent;
    const property = properties.find(p => p.name === propertyName);

    if (!property) {
        const closeButton = buyButton.parentElement.querySelector('.action-button.close');
        if (closeButton) closeButton.click();
        console.log("AI pressed the close button on the property UI.");
        setTimeout(() => endTurn(), 1000); // Ensure the turn ends
        return;
    }

    // Enhanced AI decision making
    const shouldBuy = (
        player.money >= property.price * 2 || // Buy if we have plenty of money
        property.price <= 200 || // Buy cheap properties
        hasMonopolyPotential(player, property) || // Buy if close to monopoly
        Math.random() > 0.3 // Random chance to buy
    );

    console.log(`AI deciding on ${property.name}: ${shouldBuy ? 'Buying' : 'Passing'}`);

    setTimeout(() => {
        if (shouldBuy) {
            console.log(`AI clicked the buy button for ${property.name}`);
            buyButton.click();
        } else {
            const closeButton = buyButton.parentElement.querySelector('.action-button.close');
            if (closeButton) {
                console.log("AI pressed the close button on the property UI.");
                closeButton.click();
            }
        }

        // End the turn after the decision
        setTimeout(() => endTurn(), 1000);
    }, 1000);
}

function initPlayerTokenSelection() {
    if (tokenSelectionUI && document.body.contains(tokenSelectionUI)) {
        document.body.removeChild(tokenSelectionUI);
    }
    createPlayerTokenSelectionUI(currentPlayerIndex);
}

// Edit mode functions
function toggleEditMode() {
    editMode = !editMode;
    console.log(`Edit mode: ${editMode ? 'ON' : 'OFF'}`);

    const editModeUI = document.getElementById('edit-mode-ui');
    if (editMode) {
        editModeUI.style.display = 'block';
        highlightProperties();
        controls.enabled = false;
    } else {
        editModeUI.style.display = 'none';
        resetPropertyColors();
        controls.enabled = true;
    }
}

function highlightProperties() {
    scene.traverse((object) => {
        if (object.userData.isProperty) {
            if (object.material) {
                const newMaterial = object.material.clone();
                newMaterial.color.setHex(0x00ff00);
                newMaterial.needsUpdate = true;
                object.material = newMaterial;
            }
        }
    });
}

function resetPropertyColors() {
    scene.traverse((object) => {
        if (object.userData.isProperty) {
            if (object.material) {
                const newMaterial = object.material.clone();
                newMaterial.color.setHex(0x888888);
                newMaterial.needsUpdate = true;
                object.material = newMaterial;
            }
        }
    });
}

// Mouse interaction functions
let offset = new THREE.Vector3();

function onMouseDown(event) {
    if (!editMode) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
        const intersectedObject = intersects[0].object;
        if (intersectedObject.userData.isProperty) {
            draggedObject = intersectedObject;
            offset.copy(intersects[0].point).sub(draggedObject.position);
        }
    }
}

function onMouseUp() {
    if (draggedObject) {
        const finalPosition = `Position: x=${draggedObject.position.x.toFixed(3)}, y=${draggedObject.position.y.toFixed(3)}, z=${draggedObject.position.z.toFixed(3)}`;

        const positionBox = document.getElementById('final-position');
        positionBox.textContent = finalPosition;

        const copyButton = document.getElementById('copy-position-button');
        copyButton.onclick = () => {
            navigator.clipboard.writeText(finalPosition).then(() => {
                alert('Position copied to clipboard!');
            });
        };

        draggedObject = null;
    }
}

function showTokenSpinner(tokenName) {
    // Prevent duplicate spinners
    if (document.getElementById(`spinner-${tokenName}`)) return;

    const spinner = document.createElement('div');
    spinner.className = 'token-spinner';
    spinner.id = `spinner-${tokenName}`;
    spinner.innerHTML = `
        <div class="spinner"></div>
        <div style="font-size:13px;margin-top:8px">${tokenName.replace(/^\w/, c => c.toUpperCase())} loading...</div>
    `;
    spinner.style.position = 'fixed';
    spinner.style.top = '50%';
    spinner.style.left = '50%';
    spinner.style.transform = 'translate(-50%, -50%)';
    spinner.style.zIndex = 9999;
    spinner.style.background = 'rgba(30,30,30,0.92)';
    spinner.style.padding = '22px 36px';
    spinner.style.borderRadius = '12px';
    spinner.style.color = '#fff';
    spinner.style.textAlign = 'center';
    spinner.style.boxShadow = '0 4px 16px rgba(0,0,0,0.25)';
    document.body.appendChild(spinner);

    // Add spinner CSS if not present
    if (!document.getElementById('token-spinner-style')) {
        const style = document.createElement('style');
        style.id = 'token-spinner-style';
        style.textContent = `
        .spinner {
            border: 5px solid #eee;
            border-top: 5px solid #4caf50;
            border-radius: 50%;
            width: 38px;
            height: 38px;
            animation: spin 1s linear infinite;
            margin: 0 auto 8px auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg);}
            100% { transform: rotate(360deg);}
        }
        `;
        document.head.appendChild(style);
    }
}

function hideTokenSpinner(tokenName) {
    const spinner = document.getElementById(`spinner-${tokenName}`);
    if (spinner) spinner.remove();
}



// 2. Replace your createTokens function with this:
function createTokens(onAllLoaded) {
    // Prevent multiple calls
    if (window.tokensAlreadyLoaded) {
        console.log('Tokens already loaded, skipping...');
        if (onAllLoaded) onAllLoaded();
        return;
    }
    
    const loader = new GLTFLoader();
    window.loadedTokenModels = {};
    window.tokensAlreadyLoaded = true;

    const tokenList = [
        { name: 'rolls royce', path: 'Models/RollsRoyce/rollsRoyceCarAnim.glb', scale: [0.9, 0.9, 0.9] },
        { name: 'helicopter', path: 'Models/Helicopter/helicopter.glb', scale: [0.01, 0.01, 0.01] },
        { name: 'hat', path: 'Models/TopHat/tophat.glb', scale: [0.5, 0.5, 0.5] },
        { name: 'football', path: 'Models/Football/football.glb', scale: [0.1, 0.1, 0.1] },
        { name: 'burger', path: 'Models/Cheeseburger/cheeseburger.glb', scale: [3.5, 3.5, 3.5] },
        { name: 'nike', path: 'Models/Shoe/shoe.glb', scale: [1.5, 1.5, 1.5] },
        { name: 'woman', path: 'Models/WhiteGirlIdle/WhiteGirlIdle.glb', scale: [0.02, 0.02, 0.02] }
    ];

    let loadedCount = 0;

    tokenList.forEach(tokenInfo => {
        console.log(`Loading token: ${tokenInfo.name} from ${tokenInfo.path}`);
        loader.load(tokenInfo.path, (gltf) => {
            const model = gltf.scene;
            // Fix transparency issues for woman model
            if (tokenInfo.name === 'woman') {
                model.traverse((child) => {
                    if (child.isMesh) {
                        // Handle transparency properly for woman model
                        if (child.material.map && child.material.map.image) {
                            // If there's a texture with alpha channel, enable transparency
                            child.material.transparent = true;
                            child.material.alphaTest = 0.1;
                            child.material.depthWrite = true;
                            child.material.side = THREE.DoubleSide;
                        } else {
                            // For non-transparent materials
                            child.material.transparent = false;
                            child.material.depthWrite = true;
                            child.material.side = THREE.FrontSide;
                            child.material.alphaTest = 0;
                        }
                        // Ensure material updates
                        child.material.needsUpdate = true;
                    }
                });
            }
            model.scale.set(...tokenInfo.scale);
            model.visible = false;
            model.userData.isToken = true;
            model.userData.tokenName = tokenInfo.name;
            model.position.set(22.5, 3.0, 22.5);
            scene.add(model);

            // Animation setup for tokens with animations
            if (tokenInfo.name === "woman") {
                // Idle animation
                const idleMixer = new THREE.AnimationMixer(model);
                const idleAction = idleMixer.clipAction(gltf.animations[0]);
                idleAction.clampWhenFinished = true;
                idleAction.loop = THREE.LoopRepeat;
                idleAction.play();
                model.userData.idleMixer = idleMixer;
                model.userData.idleAction = idleAction;

                // Load walk animation from separate file
                loader.load('Models/WhiteGirlWalk/WhiteGirlWalk.glb', function (walkGltf) {
                    const walkMixer = new THREE.AnimationMixer(model);
                    const walkAction = walkMixer.clipAction(walkGltf.animations[0]);
                    walkAction.clampWhenFinished = true;
                    walkAction.loop = THREE.LoopRepeat;
                    model.userData.walkMixer = walkMixer;
                    model.userData.walkAction = walkAction;
                }, undefined, function (error) {
                    console.error('Error loading woman walk animation:', error);
                });
            } else if (gltf.animations && gltf.animations.length > 0) {
                model.userData.mixer = new THREE.AnimationMixer(model);
                model.userData.actions = [];
                gltf.animations.forEach(anim => {
                    const action = model.userData.mixer.clipAction(anim);
                    action.play();
                    model.userData.actions.push(action);
                });
            }

            window.loadedTokenModels[tokenInfo.name] = model;
            loadedCount++;
            if (loadedCount === tokenList.length && typeof onAllLoaded === 'function') {
                console.log('All tokens loaded successfully');
                onAllLoaded();
            }
        }, undefined, (err) => {
            console.error(`Error loading model for ${tokenInfo.name}:`, err);
            console.error(`Failed path: ${tokenInfo.path}`);
            loadedCount++;
            if (loadedCount === tokenList.length && typeof onAllLoaded === 'function') {
                onAllLoaded();
            }
        });
    });
}

function hopWithNikeEffect(startPos, endPos, token, callback) {
    if (!token || !startPos || !endPos) {
        console.error("Invalid parameters passed to hopWithNikeEffect");
        return;
    }

    const duration = 1000; // Duration for the entire hop
    const startTime = Date.now();
    const hopHeight = 2; // Height of the hop
    const tiltAngle = 0.2; // Tilt angle for the "living shoe" effect
    const modelOffsetAngle = Math.PI; // Offset to make the Nike shoe face west

    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function for smooth animation
        const easeProgress = progress < 0.5 ?
            2 * progress * progress :
            1 - Math.pow(-2 * progress + 2, 2) / 2;

        // Calculate the current position
        const currentX = startPos.x + (endPos.x - startPos.x) * easeProgress;
        const currentZ = startPos.z + (endPos.z - startPos.z) * easeProgress;
        const currentY = startPos.y + Math.sin(progress * Math.PI) * hopHeight;

        // Apply tilt effect
        const tilt = Math.sin(progress * Math.PI) * tiltAngle;

        // Update the token's position and rotation
        token.position.set(currentX, currentY, currentZ);

        // Rotate the token to face the movement direction with the offset
        const directionVector = new THREE.Vector3(endPos.x - startPos.x, 0, endPos.z - startPos.z).normalize();
        token.rotation.set(tilt, Math.atan2(directionVector.x, directionVector.z) + modelOffsetAngle, -tilt);

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // Reset rotation after the hop
            token.rotation.set(0, Math.atan2(endPos.x - startPos.x, endPos.z - startPos.z) + modelOffsetAngle, 0);
            if (callback) callback();
        }
    }

    animate();
}

function jumpWithBigMacEffect(startPos, endPos, token, callback) {
    if (!token || !startPos || !endPos) {
        console.error("Invalid parameters passed to jumpWithBigMacEffect");
        return;
    }

    const duration = 1000; // Duration for the entire jump
    const startTime = Date.now();
    const jumpHeight = 5; // Height of the jump
    const squishFactor = 0.5; // Squish effect factor

    // Store the original scale of the token
    const originalScale = token.scale.clone();

    // Play squish sound when landing
    const squishSound = new Audio('Sounds/gooey-squish-14820.mp3');

    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function for smooth animation
        const easeProgress = progress < 0.5 ?
            2 * progress * progress :
            1 - Math.pow(-2 * progress + 2, 2) / 2;

        // Calculate the current position
        const currentX = startPos.x + (endPos.x - startPos.x) * easeProgress;
        const currentZ = startPos.z + (endPos.z - startPos.z) * easeProgress;
        const currentY = startPos.y + Math.sin(progress * Math.PI) * jumpHeight;

        // Apply squish effect while preserving the original scale
        const squish = 1 - Math.abs(Math.sin(progress * Math.PI)) * squishFactor;
        token.scale.set(
            originalScale.x, // Preserve original x scale
            originalScale.y * squish, // Apply squish to y scale
            originalScale.z // Preserve original z scale
        );

        // Update the token's position
        token.position.set(currentX, currentY, currentZ);

        // Rotate the token to face the movement direction
        const directionVector = new THREE.Vector3(endPos.x - startPos.x, 0, endPos.z - startPos.z).normalize();
        token.rotation.set(0, Math.atan2(directionVector.x, directionVector.z), 0);

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // Reset the scale after the jump
            token.scale.copy(originalScale);

            // Play the squish sound when landing
            squishSound.play().catch(error => console.error("Failed to play squish sound:", error));

            if (callback) callback();
        }
    }

    animate();
}

function playWalkAnimation(token) {
    if (token.userData.tokenName === "woman" && token.userData.walkAction) {
        console.log('Starting woman walk animation...');
        // Stop idle animation if it's playing
        if (token.userData.idleAction) {
            token.userData.idleAction.stop();
            console.log('Stopped woman idle animation');
        }
        // Play the walking animation
        if (token.userData.walkAction && token.userData.walkMixer) {
            token.userData.walkAction.reset().play();
            token.userData.walkMixer.update(0);
            console.log('Started woman walk animation');
        } else {
            console.warn('Woman walk animation not available');
        }
        // Play walking audio
        if (!token.userData.walkSound) {
            const walkSound = new Audio('Sounds/steps-high-heels-beautiful-fashion-shopping-mall-walking-movie-and-tv-sound-effects.mp3');
            walkSound.loop = true;  
            walkSound.volume = 0.7;
            token.userData.walkSound = walkSound;
        }
        if (token.userData.walkSound.paused) {
            // Don't reset currentTime - let it continue from where it left off
            token.userData.walkSound.play().catch(() => {});
        }
    } else {
        console.warn('Cannot play walk animation - token is not woman or walk action not available');
    }
}

function stopWalkAnimation(token) {
    if (token.userData.tokenName === "woman" && token.userData.walkAction) {
        console.log('Stopping woman walk animation...');
        // Stop the walking animation
        if (token.userData.walkAction) {
            token.userData.walkAction.stop();
            console.log('Stopped woman walk animation');
        }
        // Resume idle animation
        if (token.userData.idleAction) {
            token.userData.idleAction.reset().play();
            if (token.userData.idleMixer) token.userData.idleMixer.update(0);
            console.log('Resumed woman idle animation');
        }
        // Stop walking audio
        if (token.userData.walkSound) {
            token.userData.walkSound.pause();
            // Don't reset currentTime - let it resume from where it left off
        }
    } else {
        console.warn('Cannot stop walk animation - token is not woman or walk action not available');
    }
}

function updateMoneyDisplay() {
    try {
        const moneyElement = document.getElementById("player-money");
        if (!moneyElement) {
            const moneyDisplay = document.createElement("div");
            moneyDisplay.id = "player-money";
            moneyDisplay.className = "money-display";
            document.body.appendChild(moneyDisplay);
        }

        if (currentPlayerIndex < 0 || currentPlayerIndex >= players.length) {
            console.error("Invalid player index:", currentPlayerIndex);
            return;
        }

        const currentPlayer = players[currentPlayerIndex];
        if (!currentPlayer) {
            console.error("No player found at index:", currentPlayerIndex);
            return;
        }

        const playerType = isCurrentPlayerAI() ? 'AI ' : '';
        const moneyText = `${playerType}Player ${currentPlayerIndex + 1}'s Turn - Money: $${currentPlayer.money}`;
        document.getElementById("player-money").textContent = moneyText;

        checkBankruptcy(currentPlayer);
    } catch (error) {
        console.error("Error in updateMoneyDisplay:", error);
    }
}

function drawCard(cardType) {
    if (hasDrawnCard) {
        console.log("A card has already been drawn this turn. Skipping.");
        return; // Prevent drawing multiple cards
    }

    hasDrawnCard = true; // Set the flag to true after drawing a card

    const cards = cardType === "Chance" ? chanceCards : communityChestCards;
    const cardIndex = Math.floor(Math.random() * cards.length);
    const selectedCard = cards[cardIndex];
    const currentPlayer = players[currentPlayerIndex];

    if (isCurrentPlayerAI()) {
        console.log(`AI landed on ${cardType} and drew the card: "${selectedCard}".`);
        handleCardEffect(selectedCard, currentPlayer, () => {
            endTurn(); // Ensure the AI's turn ends after handling the card
        });
        return;
    }

    // Human player UI handling
    const overlay = document.createElement('div');
    overlay.className = 'property-overlay';

    const popup = document.createElement('div');
    popup.className = 'property-popup';

    const content = document.createElement('div');
    content.className = 'property-content';

    const header = document.createElement('div');
    header.className = 'popup-header';
    header.textContent = cardType;

    const cardText = document.createElement('div');
    cardText.className = 'card-prompt';
    cardText.textContent = selectedCard;

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'button-container';

    const proceedButton = document.createElement('button');
    proceedButton.className = 'action-button';
    proceedButton.textContent = 'Proceed';
    proceedButton.onclick = () => {
        overlay.classList.add('fade-out');
        setTimeout(() => {
            document.body.removeChild(overlay);
            handleCardEffect(selectedCard, currentPlayer, () => {
                endTurn(); // Ensure the human player's turn ends after handling the card
            });
        }, 300);
    };

    const closeButton = document.createElement('button');
    closeButton.className = 'action-button close';
    closeButton.textContent = 'Close';
    closeButton.onclick = () => {
        overlay.classList.add('fade-out');
        setTimeout(() => {
            document.body.removeChild(overlay);
            endTurn(); // End the turn when close button is clicked
        }, 300);
    };

    buttonContainer.appendChild(proceedButton);
    buttonContainer.appendChild(closeButton);
    content.appendChild(header);
    content.appendChild(cardText);
    content.appendChild(buttonContainer);
    popup.appendChild(content);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
        popup.classList.add('fade-in');
    });
}

function handleCardEffect(card, player, callback) {
    const regex = /\d+/;
    let amount;

    if (card.includes("Advance to")) {
        const destination = card.match(/Advance to (.+)/)[1];
        const destinationIndex = placeNames.findIndex(name => name === destination);
        if (destinationIndex >= 0) {
            const startPos = positions[player.currentPosition];
            const endPos = positions[destinationIndex];
            moveToken(startPos, endPos, player.selectedToken, () => {
                player.currentPosition = destinationIndex;
                handlePropertyLanding(player, destinationIndex);
                if (callback) callback(); // Ensure callback is invoked
            });
        }
    } else if (card.includes("Move forward")) {
        const spaces = parseInt(card.match(regex)[0]);
        moveTokenToNewPositionWithCollisionAvoidance(spaces, () => {
            handlePropertyLanding(player, player.currentPosition);
            if (callback) callback(); // Ensure callback is invoked
        });
    } else if (card.includes("Move backward")) {
        const spaces = parseInt(card.match(regex)[0]);
        moveTokenToNewPositionWithCollisionAvoidance(-spaces, () => {
            handlePropertyLanding(player, player.currentPosition);
            if (callback) callback(); // Ensure callback is invoked
        });
    } else if (card.includes("Collect") || card.includes("Receive")) {
        amount = parseInt(card.match(regex));
        player.money += amount;
        showFeedback(`Collected $${amount}!`);
        if (callback) callback(); // Ensure callback is invoked
    } else if (card.includes("Pay")) {
        amount = parseInt(card.match(regex));
        player.money -= amount;
        showFeedback(`Paid $${amount}!`);
        checkBankruptcy(player);
        if (callback) callback(); // Ensure callback is invoked
    } else if (card.includes("Go directly to Jail")) {
        goToJail(player);
        if (callback) callback(); // Ensure callback is invoked
    } else if (card === "Get Out of Jail Free") {
        player.cards = player.cards || [];
        player.cards.push(card);
        showFeedback("You received a Get Out of Jail Free card!");
        if (callback) callback(); // Ensure callback is invoked
    } else {
        if (callback) callback(); // Ensure callback is invoked
    }

    updateMoneyDisplay();
}

function handleCardAction(button, cardText) {
    const overlay = button.closest('.card-overlay');
    overlay.remove();
    applyCardEffect(cardText);
}

function handleAICardEffect(selectedCard) {
    const currentPlayer = players[currentPlayerIndex];
    const regex = /\d+/;
    let amount;

    if (selectedCard.includes("Advance to")) {
        const destination = selectedCard.match(/Advance to (.+)/)[1];
        const destinationIndex = placeNames.findIndex(name => name === destination);
        if (destinationIndex >= 0) {
            const startPos = positions[currentPlayer.currentPosition];
            const endPos = positions[destinationIndex];
            moveToken(startPos, endPos, currentPlayer.selectedToken, () => {
                currentPlayer.currentPosition = destinationIndex;
                handleAIPropertyDecision(properties.find(p => p.name === destination));
            });
        }
    } else if (selectedCard.includes("Move forward")) {
        const spaces = parseInt(selectedCard.match(regex)[0]);
        moveTokenToNewPositionWithCollisionAvoidance(spaces); // Move forward the specified number of spaces
    } else if (selectedCard.includes("Move backward")) {
        const spaces = parseInt(selectedCard.match(regex)[0]);
        moveTokenToNewPositionWithCollisionAvoidance(-spaces); // Move backward the specified number of spaces
    } else if (selectedCard.includes("Collect") || selectedCard.includes("Receive")) {
        amount = parseInt(selectedCard.match(regex));
        currentPlayer.money += amount;
        showAIDecision(`AI collected $${amount}`);
    } else if (selectedCard.includes("Pay")) {
        amount = parseInt(selectedCard.match(regex));
        currentPlayer.money -= amount;
        showAIDecision(`AI paid $${amount}`);
        checkBankruptcy(currentPlayer);
    } else if (selectedCard.includes("Go directly to Jail")) {
        goToJail(currentPlayer);
        showAIDecision("AI went to Jail!");
    } else if (selectedCard === "Get Out of Jail Free") {
        currentPlayer.cards = currentPlayer.cards || [];
        currentPlayer.cards.push(selectedCard);
        showAIDecision("AI received Get Out of Jail Free card");
    } else if (selectedCard.includes("Go back three spaces")) {
        moveTokenToNewPositionWithCollisionAvoidance(-3); // Move backward 3 spaces
        showAIDecision("AI moved back 3 spaces");
    }

    updateMoneyDisplay();

    setTimeout(() => {
        endTurn();
    }, 2000);
}

function applyCardEffect(selectedCard) {
    const currentPlayer = players[currentPlayerIndex];

    if (selectedCard.includes("Go directly to Jail")) {
        goToJail(currentPlayer);
    } else if (selectedCard.includes("Move forward")) {
        const spaces = parseInt(selectedCard.match(/\d+/)[0]);
        moveTokenToNewPositionWithCollisionAvoidance(spaces, () => {
            handlePropertyLanding(currentPlayer, currentPlayer.currentPosition);
        });
    } else if (selectedCard.includes("Move backward")) {
        const spaces = parseInt(selectedCard.match(/\d+/)[0]);
        moveTokenToNewPositionWithCollisionAvoidance(-spaces, () => {
            handlePropertyLanding(currentPlayer, currentPlayer.currentPosition);
        });
    } else if (selectedCard.includes("Collect") || selectedCard.includes("Receive")) {
        const amount = parseInt(selectedCard.match(/\$(\d+)/)[1]);
        currentPlayer.money += amount;
        showFeedback(`Collected $${amount}!`);
    } else if (selectedCard.includes("Pay")) {
        const amount = parseInt(selectedCard.match(/\$(\d+)/)[1]);
        currentPlayer.money -= amount;
        showFeedback(`Paid $${amount}!`);
        checkBankruptcy(currentPlayer);
    }

    updateMoneyDisplay();

    // Automatically end the turn after handling the card
    setTimeout(() => {
        endTurn();
    }, 1000);
}

function handleUtilitySpace(player, property) {
    if (!property.owner) {
        if (!isCurrentPlayerAI()) {
            showPropertyUI(player.currentPosition);
        }
        return;
    }

    if (property.owner !== player) {
        // Roll dice for utility rent
        const dice1 = Math.ceil(Math.random() * 6);
        const dice2 = Math.ceil(Math.random() * 6);
        const diceTotal = dice1 + dice2;

        // Calculate rent based on utility ownership
        const utilityCount = property.owner.properties.filter(p => p.type === "utility").length;
        const multiplier = utilityCount === 1 ? 4 : 10;
        const rentAmount = diceTotal * multiplier;

        showFeedback(`Rolled ${diceTotal}. Rent is ${multiplier}× dice roll.`);

        if (player.money >= rentAmount) {
            player.money -= rentAmount;
            property.owner.money += rentAmount;
            showFeedback(`Paid $${rentAmount} rent to ${property.owner.name}`);
        } else {
            handleBankruptcy(player, property.owner);
        }
        updateMoneyDisplay();
    }
}

function handleRailroadSpace(player, property) {
    if (!property.owner) {
        if (!isCurrentPlayerAI()) {
            showPropertyUI(player.currentPosition);
        }
        return;
    }

    if (property.owner !== player) {
        // Calculate rent based on number of railroads owned
        const railroadCount = property.owner.properties.filter(p => p.type === "railroad").length;
        const rentAmount = property.rentWithRailroads[railroadCount - 1];

        if (player.money >= rentAmount) {
            player.money -= rentAmount;
            property.owner.money += rentAmount;
            showFeedback(`Paid $${rentAmount} rent to ${property.owner.name}`);
        } else {
            handleBankruptcy(player, property.owner);
        }
        updateMoneyDisplay();
    }
}

function showPropertyUI(position) {
    console.log(`showPropertyUI called for position ${position}`);
    
    // Check if current player is AI first
    if (isCurrentPlayerAI()) {
        console.log("AI player - skipping property UI");
        const propertyName = placeNames[position];
        const property = properties.find(p => p.name === propertyName);
        if (property) {
            handleAIPropertyDecision(property, () => {
                setTimeout(() => endTurn(), 1500);
            });
        } else {
            setTimeout(() => endTurn(), 1500);
        }
        return;
    }

    const propertyName = placeNames[position];
    console.log(`Property name at position ${position}: ${propertyName}`);
    const property = properties.find(p => p.name === propertyName);
    console.log(`Found property:`, property);

    if (!property) {
        console.error(`No property found for position ${position} (propertyName: ${propertyName})`);
        console.log('Available properties:', properties.map(p => p.name));
        hasHandledProperty = true;
        return;
    }

    // Handle special spaces
    if (property.name === "GO") {
        showFeedback("You landed on GO! Collect $200 if you passed it.");
        hasHandledProperty = true;
        endTurn();
        return;
    }
    if (property.name === "JAIL") {
        const currentPlayer = players[currentPlayerIndex];
        showJailUI(currentPlayer);
        hasHandledProperty = true;
        return;
    }
    if (property.name === "GO TO JAIL") {
        const currentPlayer = players[currentPlayerIndex];
        goToJail(currentPlayer);
        hasHandledProperty = true;
        return;
    }
    if (property.name === "FREE PARKING") {
        const currentPlayer = players[currentPlayerIndex];
        showFreeParkingUI(currentPlayer);
        hasHandledProperty = true;
        return;
    }

    console.log(`Creating property UI for ${property.name}`);
    
    // Create overlay and popup
    const overlay = document.createElement('div');
    overlay.className = 'property-overlay';

    // Lower helicopter audio when UI is shown
    pauseHelicopterAudio();

    const popup = document.createElement('div');
    popup.className = 'property-popup';
    popup.style.width = '340px';
    popup.style.maxWidth = '95vw';
    popup.style.margin = '0 auto';

    const content = document.createElement('div');
    content.className = 'property-content';
    content.style.display = 'flex';
    content.style.flexDirection = 'column';
    content.style.alignItems = 'center';
    content.style.gap = '8px';
    content.style.fontSize = '13px';

    // --- Video on top ---
    let mediaShown = false;

    function showImageFallback() {
        let imageUrl = null;
        if (Array.isArray(property.imageUrls) && property.imageUrls.length > 0) {
            imageUrl = property.imageUrls[0];
        } else if (typeof property.imageUrls === 'string' && property.imageUrls.length > 0) {
            imageUrl = property.imageUrls;
        }
        if (imageUrl) {
            const imageContainer = document.createElement('div');
            imageContainer.className = 'property-image-container';
            imageContainer.style.width = '160px';
            imageContainer.style.height = '90px';
            imageContainer.style.overflow = 'hidden';
            imageContainer.style.borderRadius = '8px';
            imageContainer.style.margin = '0 auto 4px auto';
            imageContainer.style.position = 'relative';
            imageContainer.style.display = 'flex';
            imageContainer.style.justifyContent = 'center';
            imageContainer.style.alignItems = 'center';

            const img = document.createElement('img');
            img.src = imageUrl;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'contain';
            img.style.objectPosition = 'top';
            img.style.borderRadius = '8px';
            imageContainer.appendChild(img);
            content.appendChild(imageContainer);
            mediaShown = true;
        } else {
            // No image, show a placeholder
            const placeholder = document.createElement('div');
            placeholder.style.width = '160px';
            placeholder.style.height = '90px';
            placeholder.style.background = '#333';
            placeholder.style.display = 'flex';
            placeholder.style.justifyContent = 'center';
            placeholder.style.alignItems = 'center';
            placeholder.style.color = '#fff';
            placeholder.style.borderRadius = '8px';
            placeholder.textContent = 'No preview available';
            content.appendChild(placeholder);
            mediaShown = true;
        }
    }

    if (property.videoUrls && property.videoUrls.length > 0) {
        const videoContainer = document.createElement('div');
        videoContainer.className = 'property-video-container';
        videoContainer.style.width = '160px';
        videoContainer.style.height = '90px';
        videoContainer.style.overflow = 'hidden';
        videoContainer.style.borderRadius = '8px';
        videoContainer.style.margin = '0 auto 4px auto';
        videoContainer.style.position = 'relative';
        videoContainer.style.display = 'flex';
        videoContainer.style.justifyContent = 'center';
        videoContainer.style.alignItems = 'center';

        // Improved randomization: avoid immediate repeats
        if (!property._lastVideoIndex) property._lastVideoIndex = -1;
        let randomIndex;
        do {
            randomIndex = Math.floor(Math.random() * property.videoUrls.length);
        } while (property.videoUrls.length > 1 && randomIndex === property._lastVideoIndex);
        property._lastVideoIndex = randomIndex;
        const selectedUrl = property.videoUrls[randomIndex];

        const video = document.createElement('video');
        video.src = selectedUrl;
        video.controls = true;
        video.autoplay = true;
        video.muted = true; // Start muted like jail videos
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.preload = 'metadata';
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'cover';
        video.style.borderRadius = '8px';

        // Unmute the video when it is loaded (exactly like jail video logic)
        video.addEventListener('loadeddata', () => {
            video.muted = false;
            video.play().catch(error => console.error("Failed to play property video:", error));
        });

        // Add timeout to ensure video loads within reasonable time
        const videoLoadTimeout = setTimeout(() => {
            if (video.readyState < 2) { // HAVE_CURRENT_DATA
                console.warn(`Video load timeout for ${selectedUrl}, falling back to image`);
                video.style.display = 'none';
                showImageFallback();
            }
        }, 2000); // 2 second timeout - reduced for faster fallback

        video.addEventListener('loadeddata', () => {
            clearTimeout(videoLoadTimeout);
        });

        videoContainer.appendChild(video);

        // --- HORSEBACK RIDING: Sync galloping sound with video ---
        if (property.name === "Horseback Riding") {
            // Play sound when video starts playing
            const playHorseSound = () => {
                horseGallopingSound.currentTime = 0;
                horseGallopingSound.playbackRate = 0.6; // Slow down for serene effect
                horseGallopingSound.play().catch(() => {});
            };
            // Pause sound when video pauses
            const pauseHorseSound = () => {
                horseGallopingSound.pause();
            };
            // Sync on play/pause
            video.addEventListener('play', playHorseSound);
            video.addEventListener('pause', pauseHorseSound);
            // If video ends, pause sound
            video.addEventListener('ended', pauseHorseSound);
            // If video is playing on load, play sound
            video.addEventListener('canplay', () => {
                if (!video.paused) playHorseSound();
            });
            // Pause sound if UI is closed
            const observer = new MutationObserver(() => {
                if (!document.body.contains(videoContainer)) {
                    pauseHorseSound();
                    observer.disconnect();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
        // --- END HORSEBACK RIDING SYNC ---

        // Better error handling - try to load video, fallback to image if it fails
        video.onerror = () => {
            console.warn(`Failed to load video: ${selectedUrl}, falling back to image`);
            video.style.display = 'none';
            showImageFallback();
        };

        // Additional error handling for network issues
        video.addEventListener('error', (e) => {
            console.warn(`Video error for ${selectedUrl}:`, e);
            video.style.display = 'none';
            showImageFallback();
        });

        // Check if video file is too small (likely corrupted)
        video.addEventListener('loadstart', () => {
            // If video file is less than 1KB, it's probably corrupted
            fetch(selectedUrl, { method: 'HEAD' })
                .then(response => {
                    const contentLength = response.headers.get('content-length');
                    if (contentLength && parseInt(contentLength) < 1024) {
                        console.warn(`Video file too small (${contentLength} bytes), likely corrupted: ${selectedUrl}`);
                        video.style.display = 'none';
                        showImageFallback();
                    }
                })
                .catch(() => {
                    // If we can't check the size, try to load anyway
                });
        });

        content.appendChild(videoContainer);
        mediaShown = true;
    }

    // If no video, show image immediately
    if (!mediaShown) {
        showImageFallback();
    }

    // Add video preloading for better reliability
    if (property.videoUrls && property.videoUrls.length > 0) {
        property.videoUrls.forEach(url => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'video';
            link.href = url;
            document.head.appendChild(link);
        });
    }

    // --- Title under video ---
    const titleDiv = document.createElement('div');
    titleDiv.className = 'popup-header';
    titleDiv.style.backgroundColor = "transparent";
    titleDiv.style.fontSize = '14px';
    titleDiv.style.padding = '5px';
    titleDiv.style.margin = '0 0 4px 0';
    titleDiv.style.width = '100%';
    titleDiv.style.textAlign = 'center';
    titleDiv.textContent = property.name;
    content.appendChild(titleDiv);

    // --- Address under title (if present) ---
    if (property.address && property.address.length > 0) {
        const addressDiv = document.createElement('div');
        addressDiv.className = 'property-address';
        addressDiv.style.fontSize = '11px';
        addressDiv.style.color = '#bbb';
        addressDiv.style.margin = '0 0 6px 0';
        addressDiv.style.textAlign = 'center';
        addressDiv.textContent = property.address;
        content.appendChild(addressDiv);
    }

    // --- Details and buttons side by side ---
    const rowContainer = document.createElement('div');
    rowContainer.style.display = 'flex';
    rowContainer.style.flexDirection = 'row';
    rowContainer.style.justifyContent = 'flex-start';
    rowContainer.style.alignItems = 'stretch';
    rowContainer.style.gap = '8px';
    rowContainer.style.width = '100%';
    rowContainer.style.marginLeft = '0';
    rowContainer.style.boxSizing = 'border-box';

    // Details (side by side)
    const detailsContainer = document.createElement('div');
    detailsContainer.style.flex = '1 1 0';
    detailsContainer.style.fontSize = '11px';
    detailsContainer.style.display = 'flex';
    detailsContainer.style.alignItems = 'flex-start';
    detailsContainer.style.height = '100%';
    detailsContainer.style.minWidth = '0';

    // Ticket/concert properties
    const ticketProperties = [
        "Las Vegas Grand Prix",
        "Las Vegas Golden Knights",
        "Las Vegas Raiders",
        "Las Vegas Aces",
        "Horseback Riding",
        "Maverick Helicopter Rides",
        "Sphere",
        "Shriners Children's Open",
        "Las Vegas Little White Wedding Chapel",
        "Resorts World Theatre",
        "House of Blues",
        "Bet MGM",
        "Las Vegas Monorail",
        "Speed Vegas Off Roading"
    ];

    // Details content
    let detailsHTML = `<div class='property-details' style='display: flex; flex-direction: column; gap: 6px; height: 100%;'>`;
    detailsHTML += `<div><strong>Price:</strong> $${property.price || 'N/A'}</div>`;
    if (property.rent && !ticketProperties.includes(property.name)) {
        detailsHTML += `<div><strong>Rent:</strong> $${property.rent}</div>`;
    }
    if (property.owner) {
        detailsHTML += `<div><strong>Owner:</strong> ${property.owner.name}</div>`;
    }
    if (property.description) {
        detailsHTML += `<div style='margin-top:8px;'>${property.description}</div>`;
    }
    detailsHTML += `</div>`;
    detailsContainer.innerHTML = detailsHTML;

    // Buttons (side by side)
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.flex = '0 0 110px';
    buttonsContainer.style.display = 'flex';
    buttonsContainer.style.flexDirection = 'column';
    buttonsContainer.style.gap = '8px';
    buttonsContainer.style.alignItems = 'stretch';
    buttonsContainer.style.justifyContent = 'flex-start';
    buttonsContainer.style.height = '100%';

    // Use the createButtonContainer function to get proper buttons with close button
    const buttonContainer = createButtonContainer(property);
    buttonsContainer.appendChild(buttonContainer);

    rowContainer.appendChild(detailsContainer);
    rowContainer.appendChild(buttonsContainer);
    content.appendChild(rowContainer);

    popup.appendChild(content);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Add fade-in animation
    requestAnimationFrame(() => {
        popup.classList.add('fade-in');
    });

    // Restore helicopter audio when UI is closed
    overlay.addEventListener('transitionend', function restoreHeliAudio(e) {
        if (e.propertyName === 'opacity' && overlay.classList.contains('fade-out')) {
            resumeHelicopterAudio();
            overlay.removeEventListener('transitionend', restoreHeliAudio);
        }
    });
}

function showJailUI(player) {
    // Check if the current player is AI
    if (isCurrentPlayerAI()) {
        console.log("AI landed on Jail. Skipping Jail UI for the player.");
        setTimeout(() => {
            endTurn(); // Automatically end the turn for AI
        }, 1500);
        return;
    }

    console.log("showJailUI called for player:", player.name);

    // Create the overlay
    const overlay = document.createElement('div');
    overlay.className = 'jail-overlay';

    // Lower helicopter audio when UI is shown
    pauseHelicopterAudio();

    // Create the popup
    const popup = document.createElement('div');
    popup.className = 'jail-popup';

    // Create a container for the video and content
    const contentContainer = document.createElement('div');
    contentContainer.className = 'jail-content-container';

    // Add video container on the left
    const videoContainer = document.createElement('div');
    videoContainer.className = 'jail-video-container';
    // --- FIX: Set fixed size for video container and video ---
    videoContainer.style.width = "220px";
    videoContainer.style.height = "140px";
    videoContainer.style.flex = "0 0 220px";
    videoContainer.style.overflow = "hidden";
    videoContainer.style.borderRadius = "8px";
    videoContainer.style.display = "flex";
    videoContainer.style.alignItems = "center";
    videoContainer.style.justifyContent = "center";

    // Add a single randomized Jail video
    const jailVideos = [
        "Videos/Imgoingtojail.mp4",
        "Videos/Jailclip4.mp4",
        "Videos/Jailclip5.mp4",
        "Videos/jailclip6.mp4_1743296163946.mp4",
        "Videos/Jailmoment2(cropped).mp4",
        "Videos/jailmoment3(cropped).mp4"
    ];
    const randomVideo = jailVideos[Math.floor(Math.random() * jailVideos.length)];

    const video = document.createElement('video');
    video.src = randomVideo;
    video.controls = true;
    video.autoplay = true;
    video.muted = true; // Start muted
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'cover';
    video.style.borderRadius = '8px';

    // Unmute the video when it is loaded
    video.addEventListener('loadeddata', () => {
        video.muted = false;
        video.play().catch(error => console.error("Failed to play video:", error));
    });

    videoContainer.appendChild(video);

    // Add content container on the right
    const content = document.createElement('div');
    content.className = 'jail-content';

    // Add header
    const header = document.createElement('div');
    header.className = 'popup-header';
    header.textContent = 'Jail';

    // Add message
    const message = document.createElement('div');
    message.className = 'jail-message';
    message.textContent = player.inJail ?
        `${player.name} is in Jail for ${player.jailTurns} more turn(s).` :
        `${player.name} is just visiting Jail.`;

    // Add button container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'button-container';

    if (player.inJail) {
        // Pay Fine button
        const payFineButton = document.createElement('button');
        payFineButton.className = 'action-button';
        payFineButton.textContent = 'Pay $50 Fine';
        payFineButton.onclick = () => {
            if (player.money >= 50) {
                player.money -= 50;
                player.inJail = false;
                player.jailTurns = 0;
                showFeedback(`${player.name} paid $50 and got out of Jail.`);
                closePopup(overlay);
                endTurn();
            } else {
                showFeedback("Not enough money to pay the fine!");
            }
        };
        buttonContainer.appendChild(payFineButton);

        // Roll for Doubles button
        const rollDiceButton = document.createElement('button');
        rollDiceButton.className = 'action-button';
        rollDiceButton.textContent = 'Roll for Doubles';
        rollDiceButton.onclick = () => {
            const dice1 = Math.ceil(Math.random() * 6);
            const dice2 = Math.ceil(Math.random() * 6);
            if (dice1 === dice2) {
                player.inJail = false;
                player.jailTurns = 0;
                showFeedback(`${player.name} rolled doubles and got out of Jail!`);
                closePopup(overlay);
                endTurn();
            } else {
                player.jailTurns -= 1;
                showFeedback(`${player.name} failed to roll doubles. ${player.jailTurns} turn(s) left.`);
                if (player.jailTurns === 0) {
                    player.inJail = false;
                    showFeedback(`${player.name} is released from Jail.`);
                }
                closePopup(overlay);
                endTurn();
            }
        };
        buttonContainer.appendChild(rollDiceButton);
    } else {
        // Close button for visiting players
        const closeButton = document.createElement('button');
        closeButton.className = 'action-button close';
        closeButton.textContent = 'Close';
        closeButton.onclick = () => {
            closePopup(overlay);
            endTurn();
        };
        buttonContainer.appendChild(closeButton);
    }

    // Assemble the content
    content.appendChild(header);
    content.appendChild(message);
    content.appendChild(buttonContainer);

    // Add video and content to the container
    contentContainer.appendChild(videoContainer);
    contentContainer.appendChild(content);

    // Add the content container to the popup
    popup.appendChild(contentContainer);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Add fade-in animation
    requestAnimationFrame(() => {
        popup.classList.add('fade-in');
    });

    // Restore helicopter audio when UI is closed
    overlay.addEventListener('transitionend', function restoreHeliAudio(e) {
        if (e.propertyName === 'opacity' && overlay.classList.contains('fade-out')) {
            resumeHelicopterAudio();
            overlay.removeEventListener('transitionend', restoreHeliAudio);
        }
    });
}

function createButtonContainer(property) {
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'button-container';
    buttonContainer.style.display = 'flex';
    buttonContainer.style.flexDirection = 'column';
    buttonContainer.style.height = '100%';

    const currentPlayer = players[currentPlayerIndex];

    // Custom logic for Brothel, Monorail, Speed Vegas Off Roading, Resorts World Theatre, Sphere
    if (property.name === 'Brothel') {
        // Show both buy and rent as separate buttons
        const buyButton = document.createElement('button');
        buyButton.className = 'action-button buy';
        buyButton.textContent = property.customBuyLabel || 'Buy 1 night for 1500';
        buyButton.onclick = () => {
            if (currentPlayer.money >= 1500) {
                currentPlayer.money -= 1500;
                showFeedback(`${currentPlayer.name} bought 1 night at the Brothel for $1500`);
                updateMoneyDisplay();
                closePropertyUI();
                setTimeout(() => endTurn(), 1000);
            } else {
                showFeedback("Not enough money to buy 1 night!");
            }
        };
        buttonContainer.appendChild(buyButton);
        const rentButton = document.createElement('button');
        rentButton.className = 'action-button rent';
        rentButton.textContent = property.customRentLabel || 'Rent a room for 300';
        rentButton.onclick = () => {
            if (currentPlayer.money >= 300) {
                currentPlayer.money -= 300;
                showFeedback(`${currentPlayer.name} rented a room at the Brothel for $300`);
                updateMoneyDisplay();
                closePropertyUI();
                setTimeout(() => endTurn(), 1000);
            } else {
                showFeedback("Not enough money to rent a room!");
            }
        };
        buttonContainer.appendChild(rentButton);
    } else if (property.customBuyLabel) {
        // For Monorail, Speed Vegas Off Roading, Resorts World Theatre, Sphere, Maverick Helicopter Rides, etc.
        const buyButton = document.createElement('button');
        buyButton.className = 'action-button buy';
        buyButton.textContent = property.customBuyLabel;
        buyButton.onclick = () => {
            if (currentPlayer.money >= property.price) {
                currentPlayer.money -= property.price;
                showFeedback(`${currentPlayer.name} ${property.customBuyLabel.toLowerCase()} for $${property.price}`);
                updateMoneyDisplay();
                closePropertyUI();
                setTimeout(() => endTurn(), 1000);
            } else {
                showFeedback("Not enough money!");
            }
        };
        buttonContainer.appendChild(buyButton);
    }

    // Handle the else case for regular properties (those without customBuyLabel and not Brothel)
    if (property.name !== 'Brothel' && !property.customBuyLabel) {
        // List of properties that should use "Buy a Ticket" and have no rent
        const ticketProperties = [
            "Las Vegas Grand Prix",
            "Las Vegas Golden Knights",
            "Las Vegas Raiders",
            "Las Vegas Aces",
            "Horseback Riding",
            "Maverick Helicopter Rides",
            "Sphere",
            "Shriners Children's Open",
            "Las Vegas Little White Wedding Chapel",
            "Resorts World Theatre",
            "House of Blues",
            "Bet MGM",
            "Las Vegas Monorail",
            "Speed Vegas Off Roading"
        ];

        // Top buttons wrapper
        const topButtons = document.createElement('div');
        topButtons.style.display = 'flex';
        topButtons.style.flexDirection = 'column';
        topButtons.style.gap = '6px';
        topButtons.style.flex = '0 0 auto'; // Prevent growing/shrinking

        if (property.owner && property.owner !== currentPlayer) {
            // Only show rent button if NOT a ticket property
            if (!ticketProperties.includes(property.name)) {
                const payRentButton = document.createElement('button');
                payRentButton.className = 'action-button pay-rent';
                const rentAmount = calculateRent(property);
                payRentButton.textContent = `Pay Rent ($${rentAmount})`;
                payRentButton.onclick = () => {
                    handleRentPayment(currentPlayer, property);
                };
                topButtons.appendChild(payRentButton);
            }
        } else if (!property.owner) {
            // Buy Property, Penthouse, or Ticket button
            const buyButton = document.createElement('button');
            buyButton.className = 'action-button buy';
            if (property.isPenthouse) {
                buyButton.textContent = 'Buy Penthouse';
            } else if (ticketProperties.includes(property.name)) {
                buyButton.textContent = 'Buy a Ticket';
            } else {
                buyButton.textContent = 'Buy Property';
            }
            buyButton.onclick = () => {
                if (currentPlayer.money >= property.price) {
                    buyProperty(currentPlayer, property);
                    closePropertyUI();
                } else {
                    showFeedback(
                        property.isPenthouse ?
                        "Not enough money to buy this penthouse!" :
                        ticketProperties.includes(property.name) ?
                        "Not enough money to buy a ticket!" :
                        "Not enough money to buy this property!"
                    );
                }
            };
            topButtons.appendChild(buyButton);
        } else if (property.owner === currentPlayer) {
            // Property management buttons
            addPropertyManagementButtons(topButtons, property);
        }

        buttonContainer.appendChild(topButtons);
    }

    // Add spacer and close button for ALL cases (Brothel, customBuyLabel, and regular properties)
    const spacer = document.createElement('div');
    spacer.style.flex = '1 1 auto';
    spacer.style.minHeight = '0';
    buttonContainer.appendChild(spacer);

    // Always add close button at the bottom
    const closeButton = document.createElement('button');
    closeButton.className = 'action-button close';
    closeButton.textContent = 'Close';
    closeButton.onclick = () => {
        closePropertyUI();
        // End the turn when close button is pressed
        setTimeout(() => {
            endTurn();
        }, 300); // Small delay to allow the UI to close first
    };
    closeButton.style.marginTop = '0';
    closeButton.style.marginBottom = '20px'; // Move the button up from the bottom
    closeButton.style.alignSelf = 'stretch';
    buttonContainer.appendChild(closeButton);

    return buttonContainer;
}

function closePropertyUI() {
    const overlay = document.querySelector('.property-overlay');
    if (!overlay) {
        resumeHelicopterAudio();
        return;
    }
    const popup = overlay.querySelector('.property-popup');
    if (popup) {
        popup.classList.remove('show');
        popup.classList.add('hide');
    }
    setTimeout(() => {
        if (overlay && overlay.parentElement) {
            overlay.parentElement.removeChild(overlay);
        }
        resumeHelicopterAudio();
        
        // In multiplayer, show notification when property UI is closed
        const isMultiplayer = window.location.search.includes('room=') && window.location.search.includes('player=');
        if (isMultiplayer && window.multiplayerGame && players[currentPlayerIndex]) {
            const currentPlayer = players[currentPlayerIndex];
            window.multiplayerGame.showNotification(
                `${currentPlayer.name} closed property menu`,
                'info'
            );
        }
        
        endTurn(); // End the turn when property UI is closed
    }, 300);
}

function addPropertyManagementButtons(container, property) {
    if (!property.mortgaged) {
        // Mortgage button
        const mortgageButton = document.createElement('button');
        mortgageButton.className = 'action-button mortgage';
        mortgageButton.textContent = 'Mortgage';
        mortgageButton.onclick = () => mortgageProperty(players[currentPlayerIndex], property);
        container.appendChild(mortgageButton);

        // House/Hotel buttons for color properties
        if (property.color && !property.mortgaged) {
            addBuildingButtons(container, property);
        }
    } else {
        // Unmortgage button
        const unmortgageButton = document.createElement('button');
        unmortgageButton.className = 'action-button unmortgage';
        unmortgageButton.textContent = 'Unmortgage';
        unmortgageButton.onclick = () => unmortgageProperty(players[currentPlayerIndex], property);
        container.appendChild(unmortgageButton);
    }
}

function addBuildingButtons(container, property) {
    if (property.houses < 4) {
        const buyHouseButton = document.createElement('button');
        buyHouseButton.className = 'action-button buy-house';
        buyHouseButton.textContent = 'Buy House';
        buyHouseButton.onclick = () => buyHouse(property);
        container.appendChild(buyHouseButton);
    } else if (!property.hotel) {
        const buyHotelButton = document.createElement('button');
        buyHotelButton.className = 'action-button buy-hotel';
        buyHotelButton.textContent = 'Buy Penthouse'; // Changed from 'Buy Hotel'
        buyHotelButton.onclick = () => buyHotel(property);
        container.appendChild(buyHotelButton);
    }
}

function buyHouse(property) {
    const currentPlayer = players[currentPlayerIndex];
    if (currentPlayer.money >= property.housePrice) {
        currentPlayer.money -= property.housePrice;
        property.houses = (property.houses || 0) + 1;
        showFeedback(`${currentPlayer.name} bought a house for ${property.name}`);
        updateMoneyDisplay();
        updateBoards();
    } else {
        showFeedback("Not enough money to buy a house!");
    }
}

function buyHotel(property) {
    const currentPlayer = players[currentPlayerIndex];
    if (currentPlayer.money >= property.hotelPrice) {
        currentPlayer.money -= property.hotelPrice;
        property.hotel = true;
        property.houses = 0; // Remove houses when hotel is built
        showFeedback(`${currentPlayer.name} bought a penthouse for ${property.name}`);
        updateMoneyDisplay();
        updateBoards();
    } else {
        showFeedback("Not enough money to buy a penthouse!");
    }
}

function showErrorMessage(message) {
    const errorContainer = document.querySelector('.error-container');
    if (!errorContainer) return;

    const errorMessage = document.createElement('div');
    errorMessage.className = 'error-message';
    errorMessage.textContent = message;

    // Remove any existing error messages
    while (errorContainer.firstChild) {
        errorContainer.removeChild(errorContainer.firstChild);
    }

    errorContainer.appendChild(errorMessage);

    // Auto-remove error message after 3 seconds
    setTimeout(() => {
        if (errorMessage.parentElement) {
            errorMessage.classList.add('fade-out');
            setTimeout(() => {
                if (errorMessage.parentElement) {
                    errorMessage.parentElement.removeChild(errorMessage);
                }
            }, 300);
        }
    }, 3000);
}

function updateBoards() {
    const currentPlayer = players[currentPlayerIndex];
    updatePropertyManagementBoard(currentPlayer); // Show properties only for the current player
    updateOtherPlayersBoard(currentPlayer); // Update the board for other players
}

// Buy property logic
function buyProperty(player, property, callback) {
    if (!property || property.owner) {
        console.error("Property is either invalid or already owned.");
        return;
    }

    // Check if we're in multiplayer mode
    const isMultiplayer = window.location.search.includes('room=') && window.location.search.includes('player=');
    const isCurrentPlayer = isMultiplayer ? 
        (window.multiplayerGame && window.multiplayerGame.playerId === player.id) : 
        (player === players[currentPlayerIndex]);

    if (player.money >= property.price) {
        player.money -= property.price;
        property.owner = player;
        player.properties.push(property);

        // Show feedback to the current player
        showFeedback(`${player.name} bought ${property.name} for $${property.price}`);
        
        // In multiplayer, show notification to other players
        if (isMultiplayer && !isCurrentPlayer && window.multiplayerGame) {
            window.multiplayerGame.showNotification(
                `${player.name} bought ${property.name} for $${property.price}`,
                'info'
            );
        }
        
        updateMoneyDisplay();
        updateBoards();

        hasTakenAction = true; // Mark that the player has taken an action

        // Close the property UI after purchase
        closePropertyUI();

        // End turn if a callback is provided (for AI)
        if (callback) {
            callback(); // Ensure the AI's turn completion logic is triggered
        } else {
            setTimeout(() => endTurn(), 1000); // End the turn manually for human players
        }
    } else {
        showFeedback("Not enough money to buy this property!");
    }
}

// Add token selection
function onTokenClick(event) {
    if (initialSelectionComplete) return;
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);

    for (let intersect of intersects) {
        let object = intersect.object;
        while (object && !object.userData.isToken) {
            object = object.parent;
        }
        if (object && object.userData.isToken) {
            // Deselect previous token if exists
            if (selectedToken) {
                selectedToken.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.material.emissive.setHex(0x000000); // Reset emissive color
                    }
                });
            }
            // Select new token
            selectedToken = object;
            // Highlight selected token
            object.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    // Preserve existing material properties
                    child.material = child.material.clone();
                    child.material.needsUpdate = true;
                }
            });

            console.log(`Selected token: ${object.userData.tokenName}`);
            break;
        }
    }
}

function getBoardSquarePosition(squareIndex) {
    const boardSize = 18.5;
    const spacing = 7;

    // Calculate position based on board quadrant for 42-square board (11 squares per side)
    if (squareIndex <= 10) {
        // Bottom row (11 squares: 0-10)
        return {
            x: boardSize - squareIndex * spacing,
            y: 2, // Token height
            z: boardSize,
        };
    } else if (squareIndex <= 21) {
        // Left column (11 squares: 11-21)
        return {
            x: -boardSize,
            y: 2,
            z: boardSize - (squareIndex - 10) * spacing,
        };
    } else if (squareIndex <= 32) {
        // Top row (11 squares: 22-32)
        return {
            x: -boardSize + (squareIndex - 21) * spacing,
            y: 2,
            z: -boardSize,
        };
    } else {
        // Right column (11 squares: 33-43, but we only have 42 total)
        return {
            x: boardSize,
            y: 2,
            z: -boardSize + (squareIndex - 32) * spacing,
        };
    }
}

function onPropertyClick(event) {
    // Calculate mouse position in normalized device coordinates
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
        const clickedObject = intersects[0].object;

        // Check if we clicked on a property
        if (clickedObject.parent && clickedObject.parent.type === "Group") {
            if (!isPopupVisible) {
                createPropertyPopup(clickedObject.parent.position);
            }
        }
    } else if (isPopupVisible) {
        removePropertyPopup();
    }
}

function createPropertyPopup(position) {
    if (isPopupVisible) {
        removePropertyPopup();
    }

    // Find the property at this position
    const propertyIndex = positions.findIndex(pos =>
        pos.x === position.x &&
        pos.z === position.z
    );

    if (propertyIndex === -1) return;

    const propertyName = placeNames[propertyIndex];
    const property = properties.find(p => p.name === propertyName);

    if (!property) return;

    // Create popup geometry
    const popupGeometry = new THREE.PlaneGeometry(5, 3);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 256;

    // Style the popup
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#000000';
    context.font = 'bold 36px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    // Add property name
    context.fillText(property.name, canvas.width / 2, 40);

    // Add property details
    context.font = '24px Arial';
    let yPos = 80;
    const lineHeight = 30;

    if (property.price) {
        context.fillText(`Price: $${property.price}`, canvas.width / 2, yPos);
        yPos += lineHeight;
    }

    // Only show rent if not a ticket/concert property
    if (property.rent && !ticketProperties.includes(property.name)) {
        context.fillText(`Rent: $${property.rent}`, canvas.width / 2, yPos);
        yPos += lineHeight;
    }

    if (property.owner) {
        context.fillText(`Owner: ${property.owner.name}`, canvas.width / 2, yPos);
        yPos += lineHeight;
    }

    if (property.description) {
        // Word wrap the description
        const words = property.description.split(' ');
        let line = '';
        context.font = '20px Arial';

        words.forEach(word => {
            const testLine = line + word + ' ';
            const metrics = context.measureText(testLine);

            if (metrics.width > canvas.width - 40) {
                context.fillText(line, canvas.width / 2, yPos);
                line = word + ' ';
                yPos += lineHeight;
            } else {
                line = testLine;
            }
        });
        context.fillText(line, canvas.width / 2, yPos);
    }

    // Create texture and material
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide
    });

    // Create popup mesh
    const popup = new THREE.Mesh(popupGeometry, material);
    popup.position.set(position.x, position.y + 4, position.z);
    popup.lookAt(camera.position);

    // Add to popup group
    popupGroup.add(popup);
    isPopupVisible = true;

    // Add fade-in animation
    popup.material.opacity = 0;
    const fadeIn = () => {
        if (popup.material.opacity < 0.9) {
            popup.material.opacity += 0.05;
            requestAnimationFrame(fadeIn);
        }
    };
    fadeIn();

    // Auto-remove popup after 5 seconds
    setTimeout(() => {
        if (isPopupVisible) {
            removePropertyPopup();
        }
    }, 5000);
}

function removePropertyPopup() {
    if (isPopupVisible) {
        const popup = popupGroup.children[0];

        // Animate popup removal
        const startScale = 1;
        const endScale = 0.1;
        const duration = 300;
        const startTime = Date.now();

        function animatePopupRemoval() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            const currentScale = startScale + (endScale - startScale) * progress;
            popup.scale.set(currentScale, currentScale, currentScale);

            if (progress < 1) {
                requestAnimationFrame(animatePopupRemoval);
            } else {
                popupGroup.remove(popup);
                isPopupVisible = false;
            }
        }

        animatePopupRemoval();
    }
}

function setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); // Reduced from 0.6
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4); // Reduced from 0.8
    directionalLight.position.set(20, 40, 20);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 100;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    const pointLights = [{
            pos: [20, 15, 20],
            color: 0x888888
        },
        {
            pos: [-20, 15, 20],
            color: 0x888888
        },
        {
            pos: [-20, 15, -20],
            color: 0x888888
        },
        {
            pos: [20, 15, -20],
            color: 0x888888
        },
    ];

    pointLights.forEach((light) => {
        const pointLight = new THREE.PointLight(light.color, 0.1); // Reduced from 0.5
        pointLight.position.set(...light.pos);
        scene.add(pointLight);
    });
}

function createBoard() {
    const boardSize = 70; // Adjust size accordingly
    const boardOffset = 0; // Center the board at origin

    const boardGeometry = new THREE.BoxGeometry(boardSize, 1, boardSize);
    const boardMaterial = new THREE.MeshPhongMaterial({
        color: 0x444444,
        specular: 0x666666,
        shininess: 100,
    });
    const board = new THREE.Mesh(boardGeometry, boardMaterial);
    board.receiveShadow = true;
    board.position.set(boardOffset, 0, boardOffset);

    scene.add(board);
}

function createCardDecks() {
    const cardThickness = 0.03; // The thickness of each card
    const cardDeckLength = 5; // Adjusted length to simulate a playing card
    const cardDeckWidth = 7; // Adjust width to resemble playing card width
    const stackBaseHeight = 0.5; // The initial height of the stack
    const numCardsInStack = 40; // Number of cards in each stack

    // Function to create card stacks
    function createCardStack(deckType, position) {
        const cardMaterial = new THREE.MeshPhongMaterial({
            color: 0xCCCCCC, // Light grey color for card back
            specular: 0x777777,
            shininess: 30,
        });

        for (let i = 0; i < numCardsInStack; i++) {
            const cardGeometry = new THREE.BoxGeometry(cardDeckLength, cardThickness, cardDeckWidth);
            const cardMesh = new THREE.Mesh(cardGeometry, cardMaterial);

            // Add random slight rotation for a jumbled stack effect
            cardMesh.rotation.y = (Math.random() - 0.5) * 0.1;
            cardMesh.position.set(position.x, stackBaseHeight + i * cardThickness, position.z);

            scene.add(cardMesh);
        }

        // Add a label to the top of the stack
        addCardLabel(deckType, position, stackBaseHeight + numCardsInStack * cardThickness + (cardDeckLength / 4));
    }

    // Add a label on top of the stack
    function addCardLabel(deckType, position, height) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 256; // Adjust as necessary to fit content

        context.fillStyle = "#000";
        context.font = 'bold 20px Arial'; // Reduced font size
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        const texts = deckType.split('\n');
        texts.forEach((text, index) => {
            context.fillText(text, canvas.width / 2, (canvas.height / (texts.length + 1)) * (index + 1));
        });

        const labelTexture = new THREE.CanvasTexture(canvas);
        const labelMaterial = new THREE.MeshBasicMaterial({
            map: labelTexture,
            transparent: true
        });
        const labelGeometry = new THREE.PlaneGeometry(10, 5); // Adjust proportions as necessary
        const cardLabel = new THREE.Mesh(labelGeometry, labelMaterial);

        cardLabel.position.set(position.x, height, position.z);
        cardLabel.rotation.x = -Math.PI / 2;
        scene.add(cardLabel);
    }

    // Create Chance card stack
    createCardStack('Chance\nCards', {
        x: -12.5,
        y: 0,
        z: 0
    });

    // Create Community Chest card stack
    createCardStack('Community\nCards', {
        x: 12.5,
        y: 0,
        z: 0
    });

}

function onCardDeckClick(deckType) {
    drawCard(deckType);
}

function handleDeckClicks(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(scene.children, true);

    intersects.some((intersect) => {
        const object = intersect.object;
        if (object.material.map && object.material.map.image) {
            const text = object.material.map.image.textContent || object.material.map.image.innerHTML;
            if (text === 'Chance' || text === 'Community Cards') {
                onCardDeckClick(text);
                return true;
            }
        }
        return false;
    });
}

window.addEventListener("click", handleDeckClicks);

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function validateTurnOrder() {
    const expectedPlayerIndex = (lastPlayerIndex + 1) % players.length;

    if (currentPlayerIndex !== expectedPlayerIndex) {
        console.error(`Turn order violated! Expected Player ${expectedPlayerIndex + 1}, but got Player ${currentPlayerIndex + 1}.`);
        alert(`Turn order violated! Reverting to Player ${expectedPlayerIndex + 1}'s turn.`);

        // Revert to the correct player's turn
        currentPlayerIndex = expectedPlayerIndex;
        updateMoneyDisplay();

        // If it's an AI player's turn, execute their turn
        if (isCurrentPlayerAI()) {
            executeAITurn();
        }

        return false; // Indicate that the turn order was invalid
    }

    return true; // Turn order is valid
}

function endTurn() {
    if (isTurnInProgress) {
        console.log("Turn is still in progress. Cannot end turn yet.");
        return;
    }

    console.log(`Ending turn for Player ${currentPlayerIndex + 1} (${players[currentPlayerIndex].name})`);

    try {
        // Reset all turn-related flags
        isTurnInProgress = true; // Temporarily set to true during transition
        hasTakenAction = false;
        hasRolledDice = false;
        hasMovedToken = false;
        hasHandledProperty = false;
        hasDrawnCard = false;
        isAIProcessing = false;

        // Store the last player's index
        lastPlayerIndex = currentPlayerIndex;

        // Move to the next valid player
        let nextPlayerFound = false;
        const startingIndex = currentPlayerIndex;
        let attempts = 0;

        while (!nextPlayerFound && attempts < players.length) {
            currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
            const nextPlayer = players[currentPlayerIndex];

            if (nextPlayer && !nextPlayer.eliminated && nextPlayer.money >= 0) {
                nextPlayerFound = true;
                console.log(`Next turn is for Player ${currentPlayerIndex + 1} (${nextPlayer.name})`);
            }

            attempts++;
        }

        if (!nextPlayerFound) {
            console.error("No valid players found for next turn!");
            checkGameEnd();
            return;
        }

        const currentPlayer = players[currentPlayerIndex];

        // Update UI elements
        updateMoneyDisplay();
        updateBoards();

        // Show/hide roll button based on player type
        const rollButton = document.querySelector('.dice-button');
        if (rollButton) {
            rollButton.style.display = isCurrentPlayerAI() ? 'none' : 'block';
        }

        // Handle specific player situations
        if (currentPlayer.inJail) {
            console.log(`Player ${currentPlayerIndex + 1} is in jail`);
            handlePlayerInJail(currentPlayer);
        } else {
            // Start the next player's turn
            setTimeout(() => {
                isTurnInProgress = false; // Reset the flag
                if (isCurrentPlayerAI()) {
                    console.log(`Starting AI turn for Player ${currentPlayerIndex + 1}`);
                    executeAITurn();
                } else {
                    console.log(`Starting human turn for Player ${currentPlayerIndex + 1}`);
                    allowedToRoll = true;
                    showFeedback(`${currentPlayer.name}'s turn - Roll the dice!`);
                }
            }, 1000);
        }

        // Increment turn counter for game progression
        turnCounter++;

        // Validate game state periodically
        if (turnCounter % 4 === 0) {
            validateGameState();
        }

    } catch (error) {
        console.error("Error in endTurn:", error);
        isTurnInProgress = false; // Ensure the flag is reset even if an error occurs
    }

    const originalEndTurn = endTurn;
    endTurn = function() {
        originalEndTurn.apply(this, arguments);
        if (cameraFollowMode) {
            setTimeout(() => {
                const currentPlayer = players[currentPlayerIndex];
                if (currentPlayer && currentPlayer.selectedToken) {
                    controls.target.copy(currentPlayer.selectedToken.position);
                    camera.position.lerp(new THREE.Vector3(
                        currentPlayer.selectedToken.position.x + 4,
                        currentPlayer.selectedToken.position.y + 7,
                        currentPlayer.selectedToken.position.z + 4
                    ), 1.0);
                    controls.update();
                }
            }, 400);
        }
    };
    const originalStartTurn = startTurn;
    startTurn = function() {
        originalStartTurn.apply(this, arguments);
        if (cameraFollowMode) {
            setTimeout(() => {
                const currentPlayer = players[currentPlayerIndex];
                if (currentPlayer && currentPlayer.selectedToken) {
                    controls.target.copy(currentPlayer.selectedToken.position);
                    camera.position.lerp(new THREE.Vector3(
                        currentPlayer.selectedToken.position.x + 4,
                        currentPlayer.selectedToken.position.y + 7,
                        currentPlayer.selectedToken.position.z + 4
                    ), 1.0);
                    controls.update();
                }
            }, 400);
        }
    };
}

function startPlayerTurn(player) {
    currentlyMovingToken = null;
    isCenteringOnToken = false;
    cameraFollowToken = null;
    selectedToken = player.selectedToken;
    isTokenMoving = false;
    console.log(`Starting turn for Player ${currentPlayerIndex + 1} (${player.name})`);

    // Reset turn-related flags
    allowedToRoll = true;
    isTurnInProgress = false;
    hasDrawnCard = false; // Reset the card drawing flag

    updateMoneyDisplay();
    updateBoards();

    if (isCurrentPlayerAI()) {
        console.log(`Executing AI turn for Player ${currentPlayerIndex + 1} (${player.name})`);
        executeAITurn();
    } else {
        console.log(`Waiting for Player ${currentPlayerIndex + 1} (${player.name}) to roll dice.`);
    }
}

function validateGameState() {
    console.log("Validating game state...");

    // Validate players array
    if (!Array.isArray(players) || players.length === 0) {
        console.error("Invalid players array");
        initializePlayers();
    }

    // Validate current player index
    if (currentPlayerIndex < 0 || currentPlayerIndex >= players.length) {
        console.error("Invalid currentPlayerIndex");
        currentPlayerIndex = 0;
    }

    // Validate all players have proper properties
    players.forEach((player, index) => {
        if (typeof player.money !== 'number') {
            console.error(`Player ${index + 1} has invalid money value`);
            player.money = 5000;
        }
        if (!Array.isArray(player.properties)) {
            player.properties = [];
        }
    });

    console.log("Game state validation complete");
}

function initializePlayers() {
    // Clear existing players array
    players = [];

    // Create 4 player slots with default values
    for (let i = 0; i < 4; i++) {
        players.push({
            name: `Player ${i + 1}`,
            money: 5000,
            properties: [],
            selectedToken: null,
            tokenName: null,
            currentPosition: 0,
            isAI: false,
            inJail: false,
            jailTurns: 0,
            cards: []
        });
    }
    console.log("Players initialized:", players);
}

function createPlayerTokenSelectionUI(playerIndex) {
    if (initialSelectionComplete) return;

    // SAFETY: Remove any stray play/start game button from previous page
    const playBtn = document.getElementById('play-button');
    if (playBtn) playBtn.remove();
    const startBtn = document.getElementById('start-game');
    if (startBtn) startBtn.remove();

    tokenSelectionUI = document.createElement("div");
    tokenSelectionUI.style.position = "fixed";
    tokenSelectionUI.style.top = "10px";
    tokenSelectionUI.style.left = "20px";
    tokenSelectionUI.style.padding = "15px";
    tokenSelectionUI.style.borderRadius = "10px";
    tokenSelectionUI.style.color = "white";
    tokenSelectionUI.style.textAlign = "center";
    tokenSelectionUI.style.zIndex = "1000";
    tokenSelectionUI.style.width = "300px";
    tokenSelectionUI.style.maxHeight = "400px";

    const title = document.createElement("h2");
    title.textContent = "Select Tokens and AI Players";
    title.className = "flash-title";
    title.style.marginBottom = "15px";
    title.style.fontSize = "18px";
    tokenSelectionUI.appendChild(title);

    const tokenGrid = document.createElement("div");
    tokenGrid.style.display = (window.innerWidth < 700) ? "flex" : "grid";
    tokenGrid.style.flexDirection = (window.innerWidth < 700) ? "column" : "";
    tokenGrid.style.gridTemplateColumns = (window.innerWidth < 700) ? "" : "repeat(2, 1fr)";
    tokenGrid.style.gap = (window.innerWidth < 700) ? "2vw" : "8px";
    tokenGrid.style.padding = (window.innerWidth < 700) ? "2vw" : "5px";

    if (window.innerWidth < 700) {
        tokenGrid.style.maxHeight = "60vh";
        tokenGrid.style.overflowY = "auto";
    }

    availableTokens.forEach((token, index) => {
        if (window.loadedTokenModels && window.loadedTokenModels[token.name]) {
            const tokenButton = createTokenButton(token, index);
            tokenGrid.appendChild(tokenButton);
        }
    });

    const startButton = document.createElement("button");
    startButton.id = "start-game"; // Ensure only one exists
    startButton.textContent = "Start Game";
    startButton.className = "action-button";
    startButton.style.marginTop = "15px";
    startButton.disabled = true; // Start disabled
    startButton.style.opacity = "0.7";
    startButton.onclick = finalizePlayerSelection;

    // Add flashing effect and arrows
    startButton.style.position = "relative";
    startButton.style.transition = "box-shadow 0.3s, background 0.3s";
    startButton.style.boxShadow = "0 0 0 0 #fff";
    startButton.style.background = "#444";

    // Create arrow elements
    const arrowUp = document.createElement("div");
    arrowUp.innerHTML = "&#8595;";
    arrowUp.style.position = "absolute";
    arrowUp.style.top = "-30px";
    arrowUp.style.left = "50%";
    arrowUp.style.transform = "translateX(-50%)";
    arrowUp.style.fontSize = "28px";
    arrowUp.style.color = "#ff0";
    arrowUp.style.display = "none";
    arrowUp.className = "arrow-flash";

    const arrowDown = document.createElement("div");
    arrowDown.innerHTML = "&#8593;";
    arrowDown.style.position = "absolute";
    arrowDown.style.bottom = "-30px";
    arrowDown.style.left = "50%";
    arrowDown.style.transform = "translateX(-50%) rotate(180deg)";
    arrowDown.style.fontSize = "28px";
    arrowDown.style.color = "#ff0";
    arrowDown.style.display = "none";
    arrowDown.className = "arrow-flash";

    startButton.appendChild(arrowUp);
    startButton.appendChild(arrowDown);

    // Add flashing animation via CSS
    const style = document.createElement("style");
    style.textContent = `
        @keyframes flashButton {
            0% { box-shadow: 0 0 10px 2px #fff, 0 0 30px 10px #ff0; background: #444; }
            50% { box-shadow: 0 0 30px 10px #ff0, 0 0 10px 2px #fff; background: #666; }
            100% { box-shadow: 0 0 10px 2px #fff, 0 0 30px 10px #ff0; background: #444; }
        }
        .flash-active {
            animation: flashButton 1s infinite;
        }
        .arrow-flash {
            animation: arrowFlash 1s infinite;
        }
        @keyframes arrowFlash {
            0% { color: #ff0; opacity: 1; }
            50% { color: #fff; opacity: 0.6; }
            100% { color: #ff0; opacity: 1; }
        }
    `;
    document.head.appendChild(style);

    tokenSelectionUI.appendChild(tokenGrid);
    tokenSelectionUI.appendChild(startButton);
    document.body.appendChild(tokenSelectionUI);

    // Update button state on load
    updateStartButtonVisibility();

    // Overwrite updateStartButtonVisibility to handle flashing and arrows
    window.updateStartButtonVisibility = function() {
        const count = humanPlayerCount + aiPlayers.size;
        // Check if all selected tokens are loaded
        let allTokensLoaded = true;
        for (const player of players) {
            if (player.tokenName && (!window.loadedTokenModels || !window.loadedTokenModels[player.tokenName])) {
                allTokensLoaded = false;
                break;
            }
        }
        if (count >= 2 && count <= 4 && allTokensLoaded) {
            startButton.disabled = false;
            startButton.style.opacity = "1";
            startButton.classList.add("flash-active");
            arrowUp.style.display = "block";
            arrowDown.style.display = "block";
        } else {
            startButton.disabled = true;
            startButton.style.opacity = "0.7";
            startButton.classList.remove("flash-active");
            arrowUp.style.display = "none";
            arrowDown.style.display = "none";
        }
    };
}

function finalizePlayerSelection() {
    const totalPlayers = humanPlayerCount + aiPlayers.size;
    if (totalPlayers < 2 || totalPlayers > 4) {
        showNotification("You must select 2, 3, or 4 tokens (players or AI) before starting the game!");
        return;
    }

    // Filter out players without tokens and re-index
    let selectedPlayers = players.filter(player => player.tokenName !== null);

    // Rebuild the players array with correct indices and properties
    players = selectedPlayers.map((player, idx) => {
        // Use loadedTokenModels for all tokens (robust assignment)
        const token = window.loadedTokenModels && window.loadedTokenModels[player.tokenName];
        if (token) {
            token.visible = false; // Keep invisible until first move
            player.selectedToken = token;
        }
        return {
            name: `Player ${idx + 1}`,
            money: 5000,
            properties: [],
            selectedToken: token || null,
            tokenName: player.tokenName,
            currentPosition: 0,
            isAI: aiPlayers.has(player.tokenName),
            inJail: false,
            jailTurns: 0,
            cards: []
        };
    });

    // Reset indices and state
    currentPlayerIndex = 0;
    initialSelectionComplete = true;

    // Remove token selection UI
    if (tokenSelectionUI && tokenSelectionUI.parentElement) {
        document.body.removeChild(tokenSelectionUI);
    }
    tokenSelectionUI = null;

    // Show the "Roll Dice" button
    const rollButton = document.querySelector('.dice-button');
    if (rollButton) {
        rollButton.style.display = 'block';
    }

    updateMoneyDisplay();

    // Start game with appropriate turn
    if (isCurrentPlayerAI()) {
        executeAITurn();
    } else {
        allowedToRoll = true;
    }

    // Initialize token positions for pathfinding
    players.forEach((player, index) => {
        if (player.selectedToken) {
            updateTokenPosition(player.selectedToken, 0);
        }
    });

    // Debug log
    console.log('Game started with players:', players.map(p => ({
        name: p.name,
        tokenName: p.tokenName,
        isAI: p.isAI,
        position: p.currentPosition,
        hasToken: !!p.selectedToken
    })));
    selectedToken = null;
    
    // Update video chat if it's active
    if (typeof updateVideoChatForGameState === 'function') {
        updateVideoChatForGameState();
    }
}

function isJailCorner(startPos, endPos) {
    return (startPos.z === 22.5 && endPos.x === -22.5) || (startPos.x === -22.5 && endPos.z === 22.5);
}


function createProperties() {
    const propertySize = 5;
    const propertyHeight = 0.5;
    const yPosition = 1.5;

    const propertyMaterial = new THREE.MeshPhongMaterial({
        color: 0x888888,
        specular: 0xaaaaaa,
        shininess: 100,
    });

    positions.forEach((pos, index) => {
        const propertyGeometry = new THREE.BoxGeometry(propertySize, propertyHeight, propertySize);
        const propertyMesh = new THREE.Mesh(propertyGeometry, propertyMaterial);

        propertyMesh.position.set(pos.x, yPosition, pos.z);
        propertyMesh.castShadow = true;
        propertyMesh.receiveShadow = true;

        propertyMesh.userData.isProperty = true;
        propertyMesh.userData.name = placeNames[index];

        addPropertyText(propertyMesh, placeNames[index]);
        scene.add(propertyMesh);
    });
}

function addPropertyText(property, name) {
    const letterFolderPath = "Images/diamondLetters/"; // Path to the folder containing letter images
    const letterSize = 0.4; // Reduced size of each letter image to prevent overlapping
    const letterSpacing = 0.3; // Adjusted spacing between letters for better alignment

    const group = new THREE.Group(); // Create a group to hold all letter planes
    const textureLoader = new THREE.TextureLoader();
    const letters = name.toUpperCase().split(""); // Convert name to uppercase and split into letters

    // Calculate total width of the text for centering
    const totalWidth = letters.length * letterSpacing;
    let xOffset = -totalWidth / 2 + letterSpacing / 2; // Center the letters horizontally

    function getLetterImage(letter) {
        const validLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        if (validLetters.includes(letter)) {
            return `${letterFolderPath}Diamond${letter}.png`; // Map "A" to "DiamondA.png", etc.
        }
        return null; // Return null for invalid characters
    }

    letters.forEach((letter) => {
        if (letter === " ") {
            xOffset += letterSpacing; // Add spacing for spaces
            return;
        }

        const letterPath = getLetterImage(letter);
        if (!letterPath) {
            return;
        }

        const texture = textureLoader.load(
            letterPath,
            (texture) => {
                texture.encoding = THREE.sRGBEncoding;
                texture.flipY = false; // Ensure the texture is not flipped vertically
                texture.needsUpdate = true;
            },
            undefined,
            (error) => {
                console.error(`Failed to load texture ${letterPath}:`, error);
            }
        );

        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            alphaTest: 0.5,
            side: THREE.DoubleSide, // Ensure the texture is visible from both sides
        });

        const geometry = new THREE.PlaneGeometry(letterSize, letterSize);

        const plane = new THREE.Mesh(geometry, material);
        plane.position.set(
            xOffset,
            property.geometry.parameters.height / 2 + 0.1, // Slightly above the property square
            0
        );

        // Ensure the plane is flat and mirrored correctly
        plane.rotation.set(-Math.PI / 2, 0, Math.PI); // Lay the plane flat and rotate it 180 degrees to fix orientation
        plane.scale.set(-1, 1, 1); // Remove the horizontal mirroring

        group.add(plane);
        addDiamondSparkleToPlane(plane);

        xOffset += letterSpacing; // Move to the next letter position
    });

    property.add(group);
}

// Sparkle effect for a Three.js plane mesh (letter)
function addDiamondSparkleToPlane(plane) {
    const NUM_SPARKLES = 4 + Math.floor(Math.random() * 2); // 4-5 sparkles per letter
    const sparkleMeshes = [];
    for (let i = 0; i < NUM_SPARKLES; i++) {
        // Create a canvas for the sparkle texture
        const sparkleCanvas = document.createElement('canvas');
        sparkleCanvas.width = 32;
        sparkleCanvas.height = 32;
        const ctx = sparkleCanvas.getContext('2d');
        // Draw a simple sparkle (star)
        ctx.clearRect(0, 0, 32, 32);
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(20, 12);
        ctx.lineTo(32, 16);
        ctx.lineTo(20, 20);
        ctx.lineTo(16, 32);
        ctx.lineTo(12, 20);
        ctx.lineTo(0, 16);
        ctx.lineTo(12, 12);
        ctx.closePath();
        ctx.fillStyle = 'white';
        ctx.shadowColor = 'white';
        ctx.shadowBlur = 8;
        ctx.fill();

        const sparkleTexture = new THREE.CanvasTexture(sparkleCanvas);
        const sparkleMaterial = new THREE.MeshBasicMaterial({
            map: sparkleTexture,
            transparent: true,
            depthWrite: false,
            opacity: 0
        });
        // Make the sparkle much smaller than the letter
        const sparkleScale = 0.18 + Math.random() * 0.08; // 0.18-0.26 of letter size
        const sparkleGeometry = new THREE.PlaneGeometry(
            plane.geometry.parameters.width * sparkleScale,
            plane.geometry.parameters.height * sparkleScale
        );
        const sparkleMesh = new THREE.Mesh(sparkleGeometry, sparkleMaterial);
        // Random position within the letter plane bounds
        const margin = 0.12 * plane.geometry.parameters.width;
        const x = (Math.random() - 0.5) * (plane.geometry.parameters.width - margin);
        const y = (Math.random() - 0.5) * (plane.geometry.parameters.height - margin);
        sparkleMesh.position.copy(plane.position);
        sparkleMesh.position.x += x;
        sparkleMesh.position.z += y; // since plane is rotated, y in plane space is z in world
        sparkleMesh.position.y += 0.012 + Math.random() * 0.01; // slightly above the letter
        sparkleMesh.rotation.copy(plane.rotation);
        sparkleMesh.renderOrder = 999;

        // Animate sparkle: fade in/out and random scale/rotation
        // ...inside addDiamondSparkleToPlane, replace animateSparkle function...
        function animateSparkle() {
            const duration = 0.8 + Math.random() * 0.8; // 0.8–1.6s for each sparkle
            const delay = 2.5 + Math.random() * 2.5; // 2.5–5s between sparkles

            let startTime = null;

            function sparkleStep(timestamp) {
                if (!startTime) startTime = timestamp;
                const elapsed = (timestamp - startTime) / 1000;
                const t = Math.min(elapsed / duration, 1);

                // Use a sine wave for smooth fade in/out
                const alpha = Math.sin(Math.PI * t);
                sparkleMesh.material.opacity = 0.7 * alpha;

                // Optionally, scale and rotate for extra realism
                const scale = 0.7 + 0.3 * alpha;
                sparkleMesh.scale.setScalar(scale);

                if (t < 1) {
                    requestAnimationFrame(sparkleStep);
                } else {
                    sparkleMesh.material.opacity = 0;
                    setTimeout(() => {
                        startTime = null;
                        requestAnimationFrame(sparkleStep);
                    }, delay * 1000);
                }
            }

            // Start with a random delay for staggered sparkles
            setTimeout(() => requestAnimationFrame(sparkleStep), Math.random() * 1200);
        }
        setTimeout(animateSparkle, Math.random() * 1200);
        plane.parent.add(sparkleMesh);
        sparkleMeshes.push(sparkleMesh);
    }
}

// Helper function to wrap text
function wrapText(context, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = context.measureText(currentLine + " " + word).width;
        if (width < maxWidth) {
            currentLine += " " + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);
    return lines;
}

function createTextSprite(property, text) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 256;

    // Style text
    context.font = 'Bold 40px Arial';
    context.fillStyle = 'black';
    context.textAlign = 'center';
    context.fillText(text, 128, 128);

    // Create texture
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({
        map: texture,
        transparent: true
    });

    // Create sprite
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(2, 1, 1);
    sprite.position.set(0, property.geometry.parameters.height / 2 + 0.1, 0);

    property.add(sprite);
}

function onMouseMove(event) {
    if (!editMode || !draggedObject) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -draggedObject.position.y);
    const intersectPoint = new THREE.Vector3();
    
    if (raycaster.ray.intersectPlane(plane, intersectPoint)) {
        draggedObject.position.copy(intersectPoint).add(offset);
    }
}

// Call updateEditModeUI within toggle functions

window.addEventListener("keydown", (event) => {
    if (event.code === "KeyE") {
        toggleEditMode();
    }
});

function moveTokenWithJump(startPos, endPos, token) {
    if (!token || !startPos || !endPos) {
        console.error("Invalid parameters passed to moveTokenWithJump", {
            token,
            startPos,
            endPos
        });
        return;
    }

    const duration = 500; // Duration for one space movement
    const startTime = Date.now();
    const jumpHeight = 0.5;

    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing calculation
        const easeProgress = progress < 0.5 ?
            2 * progress * progress :
            1 - Math.pow(-2 * progress + 2, 2) / 2;

        // Calculate positions
        const currentX = startPos.x + (endPos.x - startPos.x) * easeProgress;
        const currentZ = startPos.z + (endPos.z - startPos.z) * easeProgress;
        const currentY = startPos.y + 0.29 + Math.sin(progress * Math.PI) * jumpHeight;

        // Update token position
        token.position.set(currentX, currentY, currentZ);

        // Rotate token to face movement direction
        const directionVector = new THREE.Vector3(endPos.x - startPos.x, 0, endPos.z - startPos.z).normalize();
        token.rotation.set(0, Math.atan2(directionVector.x, directionVector.z), 0);

        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }

    animate();
}

function getTokenHeight(tokenName, baseHeight) {
    const heightOffsets = {
        hat: 0.5, // Offset for the "hat" token
        woman: 0.2, // Balanced height for the "woman" token - not too high, not too low
        // Add offsets for other tokens as needed
    };

    return baseHeight + (heightOffsets[tokenName] || 0);
}

function updateFollowCamera(token) {
    if (!token) return;

    // Position the follow camera slightly above and behind the token
    const offset = new THREE.Vector3(0, 5, -10); // Adjust offset as needed
    const tokenPosition = token.position.clone();
    const cameraPosition = tokenPosition.add(offset);

    followCamera.position.copy(cameraPosition); // Directly set the camera position
    followCamera.lookAt(token.position); // Ensure the camera looks at the token
}

function moveToken(startPos, endPos, token, callback) {
    currentlyMovingToken = token;
    isTokenMoving = true;
    selectedToken = token;
    if (!token || !startPos || !endPos) {
        console.error("Invalid parameters passed to moveToken");
        return;
    }

    // Stop idle animation for all tokens before moving
    const tokenName = token.userData.tokenName;
    if (tokenName === "hat") stopHatIdle();
    else if (tokenName === "burger") stopBurgerIdle();
    else if (tokenName === "football") stopFootballIdle();
    else if (tokenName === "nike") stopNikeIdle();
    else if (tokenName === "woman") {
        // Optionally stop idleAction if needed, but usually handled by playWalkAnimation
    }
    else if (tokenName === "rolls royce") stopRollsRoyceIdle();
    else if (tokenName === "helicopter") stopHelicopterHover();

    // Determine the animation based on the token type
    if (tokenName === "nike") {
        const nikeHeight = 0.7;
        const adjustedStartPos = {
            ...startPos,
            y: startPos.y + nikeHeight
        };
        const adjustedEndPos = {
            ...endPos,
            y: endPos.y + nikeHeight
        };

        hopWithNikeEffect(adjustedStartPos, adjustedEndPos, token, () => {
            finalizeMove(token, adjustedEndPos, callback);
        });
    } else if (tokenName === "burger") {
        jumpWithBigMacEffect(startPos, endPos, token, () => {
            finalizeMove(token, endPos, callback);
        });
    } else if (tokenName === "hat") {
        const hatRestingHeight = getTokenHeight('hat', endPos.y !== undefined ? endPos.y : 2);
        jumpWithHatEffect({
                ...startPos,
                y: hatRestingHeight
            }, {
                ...endPos,
                y: hatRestingHeight
            },
            token,
            () => {
                finalizeMove(token, endPos, callback);
            }
        );
    } else if (tokenName === "woman") {
        const womanHeight = 0.3; // Slightly higher during movement to prevent feet clipping
        const adjustedStartPos = {
            ...startPos,
            y: startPos.y + womanHeight
        };
        const adjustedEndPos = {
            ...endPos,
            y: endPos.y + womanHeight
        };

        const duration = 1000;
        const startTime = Date.now();

        playWalkAnimation(token);

        function animate() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            const currentX = adjustedStartPos.x + (adjustedEndPos.x - adjustedStartPos.x) * progress;
            const currentZ = adjustedStartPos.z + (adjustedEndPos.z - adjustedStartPos.z) * progress;

            token.position.set(currentX, adjustedStartPos.y, currentZ);

            const directionVector = new THREE.Vector3(
                adjustedEndPos.x - adjustedStartPos.x,
                0,
                adjustedEndPos.z - adjustedStartPos.z
            ).normalize();
            token.rotation.set(0, Math.atan2(directionVector.x, directionVector.z), 0);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                stopWalkAnimation(token);
                finalizeMove(token, adjustedEndPos, callback);
            }
        }

        animate();
    } else if (tokenName === "football") {
        // Football movement is handled elsewhere (throwFootballAnimation)
        finalizeMove(token, endPos, callback);
    } else if (tokenName === "rolls royce") {
        // Rolls Royce handled by driveWithRollsRoyceEffect or driveRollsRoyceAlongPath
        finalizeMove(token, endPos, callback);
    } else if (tokenName === "helicopter") {
        // Helicopter should use proper helicopter movement functions
        // This should be handled by moveHelicopterToNewPosition instead
        // For now, use a simple movement to avoid helicopter sound issues
        const duration = 1000;
        const startTime = Date.now();

        function animate() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            const currentX = startPos.x + (endPos.x - startPos.x) * progress;
            const currentZ = startPos.z + (endPos.z - startPos.z) * progress;

            token.position.set(currentX, startPos.y, currentZ);

            const directionVector = new THREE.Vector3(
                endPos.x - startPos.x,
                0,
                endPos.z - startPos.z
            ).normalize();
            token.rotation.set(0, Math.atan2(directionVector.x, directionVector.z), 0);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                finalizeMove(token, endPos, callback);
            }
        }

        animate();
    } else {
        // Default movement for other tokens
        const duration = 1000;
        const startTime = Date.now();

        function animate() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            const currentX = startPos.x + (endPos.x - startPos.x) * progress;
            const currentZ = startPos.z + (endPos.z - startPos.z) * progress;

            token.position.set(currentX, startPos.y, currentZ);

            const directionVector = new THREE.Vector3(
                endPos.x - startPos.x,
                0,
                endPos.z - startPos.z
            ).normalize();
            token.rotation.set(0, Math.atan2(directionVector.x, directionVector.z), 0);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                finalizeMove(token, endPos, callback);
            }
        }

        animate();
    }
}


function finalizeMove(token, endPos, callback) {
    const baseHeight = endPos.y;
    let finalHeight = getTokenHeight(token.userData.tokenName, baseHeight);
    if (token.userData.tokenName === "nike") finalHeight += 0.5;
    else if (token.userData.tokenName === "burger") finalHeight += 0.7;
    else if (token.userData.tokenName === "speed boat") finalHeight += 0.5;
    else if (token.userData.tokenName === "rolls royce") finalHeight += 0.3;
    else if (token.userData.tokenName === "football") finalHeight += 1.0;
    token.position.set(endPos.x, finalHeight, endPos.z);
    isTokenMoving = false;
    currentlyMovingToken = null;

    // --- Start idle animation for tokens that need it ---
    const tokenName = token.userData.tokenName;
    if (tokenName === "hat") startHatIdle(token);
    else if (tokenName === "burger") startBurgerIdle(token);
    else if (tokenName === "football") startFootballIdle(token);
    else if (tokenName === "nike") startNikeIdle(token);
    // Rolls Royce and helicopter handled in their own movement functions
    // Woman uses built-in GLTF idle

    if (callback) callback();
}

function createTokenButton(token, index) {
    const tokenButton = document.createElement("div");
    tokenButton.className = "token-button";

    // Style the button
    tokenButton.style.backgroundColor = players.some(player => player.tokenName === token.name) ? "#555" : "#333";
    tokenButton.style.pointerEvents = players.some(player => player.tokenName === token.name) ? "none" : "auto";
    tokenButton.style.position = "relative";
    tokenButton.style.transition = "all 0.3s ease";
    tokenButton.style.display = "flex";
    tokenButton.style.flexDirection = "column";
    tokenButton.style.alignItems = "center";
    tokenButton.style.justifyContent = "center";
    tokenButton.style.padding = "10px 0";
    tokenButton.style.margin = "4px";
    tokenButton.style.borderRadius = "8px";
    tokenButton.style.width = "150px"; // Increased width from 120px to 150px
    tokenButton.style.height = "100px";
    tokenButton.style.cursor = "pointer";

    // Create content container
    const tokenContent = document.createElement("div");
    tokenContent.className = "token-content";
    tokenContent.style.display = "flex";
    tokenContent.style.flexDirection = "column";
    tokenContent.style.alignItems = "center";
    tokenContent.style.justifyContent = "center";
    tokenContent.style.width = "100%";
    tokenContent.style.height = "100%";

    // Create token image
    const tokenImg = document.createElement("img");
    tokenImg.src = getTokenImageUrl(token.name);
    tokenImg.alt = token.displayName;
    tokenImg.style.width = "60px";
    tokenImg.style.height = "50px";
    tokenImg.style.marginBottom = "8px";
    tokenImg.style.borderRadius = "4px";
    tokenImg.style.objectFit = "contain";

    // Check if token is already owned
    const owner = players.find(player => player.tokenName === token.name);
    if (owner) {
        tokenImg.style.filter = "grayscale(100%) blur(1px)";
    }

    // Create token name label
    const tokenName = document.createElement("div");
    tokenName.textContent = token.displayName;
    tokenName.style.fontSize = "12px";
    tokenName.style.fontWeight = "bold";
    tokenName.style.textAlign = "center";
    tokenName.style.color = owner ? "#888" : "#fff";
    tokenName.style.minHeight = "20px";
    tokenName.style.maxWidth = "100%";

    // Create AI button
    const aiButton = document.createElement("button");
    aiButton.className = "ai-button";
    aiButton.textContent = aiPlayers.has(token.name) ? "Disable PC" : "Click to Enable PC";
    aiButton.classList.toggle("active", aiPlayers.has(token.name));
    aiButton.style.marginTop = "5px";
    aiButton.style.padding = "4px 8px";
    aiButton.style.borderRadius = "4px";
    aiButton.style.border = "none";
    aiButton.style.cursor = "pointer";
    aiButton.style.backgroundColor = aiPlayers.has(token.name) ? "#4CAF50" : "#666";
    aiButton.style.color = "#fff";

    // Add AI indicator
    const aiIndicator = document.createElement("div");
    aiIndicator.className = "ai-indicator";
    aiIndicator.classList.toggle("active", aiPlayers.has(token.name));
    aiIndicator.style.position = "absolute";
    aiIndicator.style.top = "5px";
    aiIndicator.style.right = "5px";
    aiIndicator.style.width = "10px";
    aiIndicator.style.height = "10px";
    aiIndicator.style.borderRadius = "50%";
    aiIndicator.style.backgroundColor = aiPlayers.has(token.name) ? "#4CAF50" : "transparent";

    // Handle AI button click
    aiButton.onclick = (e) => {
        e.stopPropagation();
        if (!initialSelectionComplete) {
            toggleAI(token, aiButton);
        }
    };

    // Handle token selection
    tokenButton.addEventListener("click", () => {
        if (!initialSelectionComplete && !owner) {
            if (humanPlayerCount >= 4) {
                alert("Maximum 4 players allowed!");
                return;
            }
            if (aiPlayers.has(token.name)) {
                alert("This token is set as AI player!");
                return;
            }
            const currentPlayer = players[humanPlayerCount];
            if (!currentPlayer) {
                console.error("Invalid player index:", humanPlayerCount);
                return;
            }
            currentPlayer.tokenName = token.name;
            // If model is loaded, assign immediately
            if (window.loadedTokenModels && window.loadedTokenModels[token.name]) {
                currentPlayer.selectedToken = window.loadedTokenModels[token.name];
                window.loadedTokenModels[token.name].visible = true;
                window.loadedTokenModels[token.name].position.set(22.5, 2.5, 22.5);
                window.loadedTokenModels[token.name].userData.playerIndex = humanPlayerCount;
            } else {
                // Queue assignment for when model loads
                window.tokenModelReadyCallbacks = window.tokenModelReadyCallbacks || {};
                window.tokenModelReadyCallbacks[token.name] = (model) => {
                    currentPlayer.selectedToken = model;
                    model.visible = true;
                    model.position.set(22.5, 2.5, 22.5);
                    model.userData.playerIndex = humanPlayerCount;
                };
            }
            humanPlayerCount++;
            // Update button appearance
            tokenImg.style.filter = "grayscale(100%) blur(1px)";
            tokenButton.style.backgroundColor = "#555";
            tokenButton.style.pointerEvents = "none";
            tokenName.style.color = "#888";
            aiButton.disabled = true;
            aiButton.style.opacity = "0.5";
            aiButton.style.cursor = "not-allowed";
            updateStartButtonVisibility();
            console.log(`Token ${token.name} selected for Player ${humanPlayerCount}`);
        }
    });

    // Assemble the button
    tokenContent.appendChild(tokenImg);
    tokenContent.appendChild(tokenName);
    tokenContent.appendChild(aiButton);
    tokenButton.appendChild(tokenContent);
    tokenButton.appendChild(aiIndicator);

    // Add "Taken" overlay if token is already selected
    if (owner) {
        const takenOverlay = document.createElement("div");
        takenOverlay.className = "taken-overlay";
        takenOverlay.textContent = "Taken";
        takenOverlay.style.position = "absolute";
        takenOverlay.style.top = "0";
        takenOverlay.style.left = "0";
        takenOverlay.style.right = "0";
        takenOverlay.style.bottom = "0";
        takenOverlay.style.display = "flex";
        takenOverlay.style.justifyContent = "center";
        takenOverlay.style.alignItems = "center";
        takenOverlay.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
        takenOverlay.style.color = "#fff";
        takenOverlay.style.borderRadius = "8px";
        takenOverlay.style.fontSize = "14px";
        takenOverlay.style.fontWeight = "bold";
        tokenButton.appendChild(takenOverlay);
    }

    // Add hover effect
    tokenButton.addEventListener('mouseover', () => {
        if (!owner && !initialSelectionComplete) {
            tokenButton.style.transform = 'scale(1.05)';
            tokenButton.style.backgroundColor = "#444";
        }
    });

    tokenButton.addEventListener('mouseout', () => {
        if (!owner && !initialSelectionComplete) {
            tokenButton.style.transform = 'scale(1)';
            tokenButton.style.backgroundColor = "#333";
        }
    });

    return tokenButton;
}

function driveWithRollsRoyceEffect(startPos, endPos, token, callback) {
    if (!token || !startPos || !endPos) {
        console.error("Invalid parameters passed to driveWithRollsRoyceEffect");
        return;
    }
    
    // Set movement flags for camera following
    currentlyMovingToken = token;
    isTokenMoving = true;
    
    // Use animated model if available
    const animatedModel = token.userData.animatedModel;
    let mixer, actions;
    if (animatedModel) {
        stopRollsRoyceIdle();
        token.visible = false;
        animatedModel.visible = true;
        animatedModel.position.copy(token.position);
        animatedModel.rotation.copy(token.rotation);
        mixer = animatedModel.userData.mixer;
        actions = animatedModel.userData.actions;
        if (actions) actions.forEach(action => action.play());
    }
    selectedToken = animatedModel || token;

    // Calculate direction and distance
    const from = new THREE.Vector3(startPos.x, startPos.y, startPos.z);
    const to = new THREE.Vector3(endPos.x, endPos.y, endPos.z);
    const direction = to.clone().sub(from).normalize();
    const distance = from.distanceTo(to);

    // Parameters for the wavy path
    const amplitude = 1.2; // How far to swerve left/right (increase for more drama)
    const frequency = 2.5; // How many full waves per trip (increase for more wiggle)
    const duration = (1200 + distance * 18) * 3.5; // SLOWER: 3.5x
    const startTime = Date.now();

    // Find a vector perpendicular to the direction of travel (for swerving)
    const perp = new THREE.Vector3(-direction.z, 0, direction.x).normalize();

    function animate() {
        const elapsed = Date.now() - startTime;
        const t = Math.min(elapsed / duration, 1);

        // Linear interpolation along the main path
        const mainPos = from.clone().lerp(to, t);

        // Swerve offset
        const wave = Math.sin(t * Math.PI * frequency) * amplitude * (1 - Math.abs(2 * t - 1)); // fade at ends
        mainPos.add(perp.clone().multiplyScalar(wave));

        // Set position and rotation
        if (animatedModel) {
            animatedModel.position.set(mainPos.x, mainPos.y + 0.29, mainPos.z);

            // Face the direction of travel (with a little tilt for style)
            const nextT = Math.min(t + 0.01, 1);
            const nextMainPos = from.clone().lerp(to, nextT);
            nextMainPos.add(perp.clone().multiplyScalar(Math.sin(nextT * Math.PI * frequency) * amplitude * (1 - Math.abs(2 * nextT - 1))));
            const dir = nextMainPos.clone().sub(mainPos).normalize();
            const angle = Math.atan2(dir.x, dir.z);
            const tilt = Math.sin(t * Math.PI * frequency) * 0.18; // gentle tilt as it swerves
            animatedModel.rotation.set(tilt, angle, 0);

            if (mixer) mixer.update(1 / 60);
        } else {
            token.position.set(mainPos.x, mainPos.y + 0.29, mainPos.z);
            const nextT = Math.min(t + 0.01, 1);
            const nextMainPos = from.clone().lerp(to, nextT);
            nextMainPos.add(perp.clone().multiplyScalar(Math.sin(nextT * Math.PI * frequency) * amplitude * (1 - Math.abs(2 * nextT - 1))));
            const dir = nextMainPos.clone().sub(mainPos).normalize();
            const angle = Math.atan2(dir.x, dir.z);
            const tilt = Math.sin(t * Math.PI * frequency) * 0.18;
            token.rotation.set(tilt, angle, 0);
        }

        if (t < 1) {
            requestAnimationFrame(animate);
        } else {
            // End: keep animated model visible and start idle anim
            // Clear movement flags for camera following
            isTokenMoving = false;
            currentlyMovingToken = null;
            
            if (animatedModel) {
                startRollsRoyceIdle(animatedModel, {
                    x: mainPos.x,
                    y: mainPos.y + 0.29,
                    z: mainPos.z
                });
            }
            if (callback) callback();
        }
    }
    animate();
}

function driveRollsRoyceAlongPath(token, path, callback) {
    if (accelerationSound.paused) {
        accelerationSound.currentTime = 0;
        accelerationSound.play().catch(() => {});
    }
    // Use animated model if available
    const animatedModel = token.userData.animatedModel || token;
    stopRollsRoyceIdle(); // Stop idle before moving

    // Build a smooth path using CatmullRomCurve3
    const points = path.map(p => new THREE.Vector3(p.x, p.y, p.z));
    const curve = new CatmullRomCurve3(points);
    const duration = (1200 + points.length * 180) * 3.5; // SLOWER: 3.5x
    const startTime = Date.now();
    let lastDir = null;

    function animate() {
        const elapsed = Date.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        const pos = curve.getPoint(t);
        const nextPos = curve.getPoint(Math.min(t + 0.01, 1));
        const prevPos = curve.getPoint(Math.max(t - 0.01, 0));
        const dir = nextPos.clone().sub(prevPos).normalize();
        // Detect sharp right turn for drift
        let drift = 0;
        if (lastDir) {
            const angleDelta = Math.atan2(dir.x, dir.z) - Math.atan2(lastDir.x, lastDir.z);
            if (angleDelta > 0.25) drift = Math.min(angleDelta, 0.7); // right drift
            else if (angleDelta < -0.25) drift = Math.max(angleDelta, -0.7); // left drift
        }
        lastDir = dir.clone();
        // Tilt the car for drift
        const tilt = drift * 0.7;
        if (animatedModel) {
            animatedModel.position.set(pos.x, pos.y + 0.29, pos.z);
            animatedModel.rotation.set(tilt, Math.atan2(dir.x, dir.z), 0);
            if (animatedModel.userData.mixer) animatedModel.userData.mixer.update(1 / 60);
        } else {
            token.position.set(pos.x, pos.y + 0.29, pos.z);
            token.rotation.set(tilt, Math.atan2(dir.x, dir.z), 0);
        }
        if (t < 1) {
            requestAnimationFrame(animate);
        } else {
            // End: keep animated model visible and start idle anim
            // Clear movement flags for camera following
            isTokenMoving = false;
            currentlyMovingToken = null;
            
            if (animatedModel) {
                startRollsRoyceIdle(animatedModel, {
                    x: pos.x,
                    y: pos.y + 0.29,
                    z: pos.z
                });
            }
            if (callback) callback();
        }
    }
    animate();
}

// --- Audio Distance Helper ---
function updateTokenAudioVolume(token, audio, maxDistance = 40, minVolume = 0.05, maxVolume = 1.0) {
    if (!token || !audio || !token.visible) return;
    const distance = camera.position.distanceTo(token.position);
    let volume = 1 - (distance / maxDistance);
    volume = Math.max(minVolume, Math.min(maxVolume, volume));
    audio.volume = volume;
    // Don't start playing the audio here - only adjust volume if it's already playing
}

function throwFootballAnimation(token, endPos, finalHeight, callback) {
    // Set movement flags for camera following
    currentlyMovingToken = token;
    isTokenMoving = true;
    
    selectedToken = token;
    const startPos = token.position.clone();
    let endVec = (endPos instanceof THREE.Vector3) ? endPos : new THREE.Vector3(endPos.x, endPos.y, endPos.z);

    const duration = 1200; // Duration for the throw
    const arcHeight = 5; // Height of the arc

    // --- Play new woosh sound for football throw ---
    const wooshSound = new Audio('Sounds/woosh-260275.mp3');
    wooshSound.volume = 0.7;
    wooshSound.play().catch(() => {});

    const startTime = Date.now();

    function getArcPoint(t) {
        // Parabolic arc for Y
        const x = startPos.x + (endVec.x - startPos.x) * t;
        const z = startPos.z + (endVec.z - startPos.z) * t;
        // Parabola: peak at t=0.5
        const y = startPos.y + (endVec.y - startPos.y) * t + arcHeight * 4 * t * (1 - t);
        return new THREE.Vector3(x, y, z);
    }

    function animate() {
        const now = Date.now();
        let t = (now - startTime) / duration;
        if (t > 1) t = 1;

        // Position
        const pos = getArcPoint(t);
        token.position.copy(pos);

        // Velocity (for facing direction)
        const deltaT = 0.001;
        const nextT = Math.min(t + deltaT, 1);
        const prevT = Math.max(t - deltaT, 0);
        const nextPos = getArcPoint(nextT);
        const prevPos = getArcPoint(prevT);
        const velocity = nextPos.clone().sub(prevPos).normalize();

        // Orient the football to face the direction of movement
        const forward = new THREE.Vector3(0, 0, 1);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(forward, velocity);

        // Add spiral: rotate around the local Z axis (forward axis)
        const spiralSpeed = 18 * Math.PI; // radians/sec
        const spiralAngle = spiralSpeed * (now - startTime) / 1000;
        const spiralQuat = new THREE.Quaternion().setFromAxisAngle(forward, spiralAngle);

        // Combine: first face the velocity, then spiral around forward
        token.quaternion.copy(quaternion).multiply(spiralQuat);

        if (t < 1) {
            requestAnimationFrame(animate);
        } else {
            // Snap to final position and orientation
            const restingY = (typeof getTokenHeight === 'function') ? getTokenHeight('football', endVec.y) : (endVec.y + 1.0);
            token.position.set(endVec.x, restingY, endVec.z);
            // Face the direction from start to end
            const finalDir = endVec.clone().sub(startPos).normalize();
            const finalQuat = new THREE.Quaternion().setFromUnitVectors(forward, finalDir);
            token.quaternion.copy(finalQuat);
            // Clear movement flags for camera following
            isTokenMoving = false;
            currentlyMovingToken = null;
            startFootballIdleAnimation(token);
            if (callback) callback();
        }
    }
    animate();
}

function startFootballIdleAnimation(token) {
    // Make the football hover just above the square, spin, and gently wobble in the air
    let idleStart = Date.now();
    let running = true;
    // Always use a fixed board Y height for the football
    const boardBaseY = 2.0; // Board height for all squares
    const hoverOffset = 0.3; // How high above the board the football floats
    const spinSpeed = 1.5 * Math.PI; // radians/sec
    const wobbleSpeed = 1.1; // Hz
    const wobbleAmount = 0.18; // radians
    const bobSpeed = 1.2; // Hz
    const bobAmount = 0.18; // units

    // Optionally, align the football upright (pointing forward)
    token.rotation.set(0, 0, 0);

    function idleAnim() {
        if (!running) return;
        const t = (Date.now() - idleStart) / 1000;

        // Hover up and down (gentle bob)
        const y = boardBaseY + hoverOffset + Math.sin(t * bobSpeed * Math.PI * 2) * bobAmount;
        token.position.set(token.position.x, y, token.position.z);

        // Spin around the Y axis (vertical spin)
        token.rotation.y = t * spinSpeed;

        // Gentle wobble (tilt X and Z)
        token.rotation.x = Math.sin(t * wobbleSpeed * Math.PI * 2) * wobbleAmount;
        token.rotation.z = Math.cos(t * (wobbleSpeed * 0.8) * Math.PI * 2) * (wobbleAmount * 0.7);

        requestAnimationFrame(idleAnim);
    }
    idleAnim();
    // Store a reference to stop the animation later if needed
    token.userData.footballIdleAnim = () => {
        running = false;
    };
}

function jumpWithHatEffect(startPos, endPos, token, callback) {
    if (!token || !startPos || !endPos) {
        console.error("Invalid parameters passed to jumpWithHatEffect");
        return;
    }

    const duration = 1000;
    const startTime = Date.now();
    const jumpHeight = 2.5;

    // Always land upright: alternate between top and bottom, never on side
    // We'll use a boolean to track which side to land on (top or bottom)
    token.userData.hatUpright = !token.userData.hatUpright; // flip each jump

    function getArcPoint(t) {
        const x = startPos.x + (endPos.x - startPos.x) * t;
        const z = startPos.z + (endPos.z - startPos.z) * t;
        const y = startPos.y + Math.sin(t * Math.PI) * jumpHeight;
        return {
            x,
            y,
            z
        };
    }

    function animate() {
        const elapsed = Date.now() - startTime;
        const t = Math.min(elapsed / duration, 1);

        const {
            x,
            y,
            z
        } = getArcPoint(t);
        token.position.set(x, y, z);

        // Always keep hat upright: rotate only around Y, not X/Z
        // Optionally, flip 180deg on Y to alternate between top/bottom
        let uprightAngle = token.userData.hatUpright ? 0 : Math.PI;
        token.rotation.set(0, uprightAngle, 0);

        if (t < 1) {
            requestAnimationFrame(animate);
        } else {
            // Snap to final position and orientation
            token.position.set(endPos.x, endPos.y, endPos.z);
            token.rotation.set(0, uprightAngle, 0);
            // Clear movement flags for camera following
            isTokenMoving = false;
            currentlyMovingToken = null;
            if (callback) callback();
        }
    }

    animate();
}

// Default animation for non-speedboat tokens
function driveWithDefaultEffect(startPos, endPos, token, callback) {
    if (!token || !startPos || !endPos) {
        console.error("Invalid parameters passed to driveWithDefaultEffect");
        return;
    }

    const duration = 500; // Reduced from 1000 to 500 (0.5 seconds)
    const startTime = Date.now();

    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const easeProgress = progress < 0.5 ?
            2 * progress * progress :
            1 - Math.pow(-2 * progress + 2, 2) / 2;

        const currentX = startPos.x + (endPos.x - startPos.x) * easeProgress;
        const currentZ = startPos.z + (endPos.z - startPos.z) * easeProgress;
        const currentY = startPos.y + 0.29;

        const directionVector = new THREE.Vector3(endPos.x - startPos.x, 0, endPos.z - startPos.z).normalize();
        const angle = Math.atan2(directionVector.x, directionVector.z);

        token.position.set(currentX, currentY, currentZ);
        token.rotation.set(0, angle, 0);

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // Clear movement flags for camera following
            isTokenMoving = false;
            currentlyMovingToken = null;
            if (callback) callback();
        }
    }

    animate();
}

function driveWithSpeedboatEffect(startPos, endPos, token, callback) {
    if (!token || !startPos || !endPos) {
        console.error("Invalid parameters passed to driveWithSpeedboatEffect");
        return;
    }
    
    // Set movement flags for camera following
    currentlyMovingToken = token;
    isTokenMoving = true;

    const duration = 1000; // Reduced from 2000 to 1000 (1 second)
    const startTime = Date.now();
    const bobbingHeight = 0.05;
    const bobbingFrequency = 1.5;
    const modelOffsetAngle = Math.PI / 2;

    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const easeProgress = progress < 0.5 ?
            2 * progress * progress :
            1 - Math.pow(-2 * progress + 2, 2) / 2;

        const currentX = startPos.x + (endPos.x - startPos.x) * easeProgress;
        const currentZ = startPos.z + (endPos.z - startPos.z) * easeProgress;
        const currentY = startPos.y + 0.7 + Math.sin(elapsed / 1000 * bobbingFrequency * Math.PI) * bobbingHeight;

        const directionVector = new THREE.Vector3(endPos.x - startPos.x, 0, endPos.z - startPos.z).normalize();
        const angle = Math.atan2(directionVector.x, directionVector.z);

        token.position.set(currentX, currentY, currentZ);
        token.rotation.set(0, angle + modelOffsetAngle, 0);

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // Clear movement flags for camera following
            isTokenMoving = false;
            currentlyMovingToken = null;
            if (callback) callback();
        }
    }

    animate();
}

function driveStraightWithSpeedboat(startPos, endPos, token, callback) {
    driveWithSpeedboatEffect(startPos, endPos, token, callback);
}

function flyWithHelicopterEffect(startPos, endPos, token, callback) {
    if (!token || !startPos || !endPos) {
        console.error("Invalid parameters passed to flyWithHelicopterEffect");
        return;
    }
    
    // Set movement flags for camera following
    currentlyMovingToken = token;
    isTokenMoving = true;
    // Start helicopter sound for movement only if this is a helicopter token
    if (token.userData.tokenName === "helicopter") {
        helicopterSound.currentTime = 0;
        helicopterSound.play().catch(() => {});
    }

    // Swap to animated model if available
    const animatedModel = token.userData.animatedModel;
    let mixer, action;
    if (animatedModel) {
        // Hide static, show animated
        token.visible = false;
        animatedModel.visible = true;
        animatedModel.position.copy(token.position);
        animatedModel.rotation.copy(token.rotation);
        mixer = animatedModel.userData.mixer;
        action = animatedModel.userData.action;
        if (action) {
            action.reset();
            action.play();
        }
    }

    const duration = 1000;
    const flightHeight = 5;
    const startTime = Date.now();
    const modelOffsetAngle = Math.PI + Math.PI / 2;

    function easeInOutSine(t) {
        return -(Math.cos(Math.PI * t) - 1) / 2;
    }

    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        let y;
        if (progress < 0.18) {
            y = startPos.y + easeInOutSine(progress / 0.18) * flightHeight;
        } else if (progress > 0.82) {
            y = startPos.y + flightHeight - easeInOutSine((progress - 0.82) / 0.18) * flightHeight;
        } else {
            y = startPos.y + flightHeight;
        }

        const currentX = startPos.x + (endPos.x - startPos.x) * progress;
        const currentZ = startPos.z + (endPos.z - startPos.z) * progress;
        const directionVector = new THREE.Vector3(endPos.x - startPos.x, 0, endPos.z - startPos.z).normalize();
        const angle = Math.atan2(directionVector.x, directionVector.z);
        let tilt = Math.sin(progress * Math.PI) * 0.4;

        // Move the animated model if present, else the static
        if (animatedModel) {
            animatedModel.position.set(currentX, y, currentZ);
            animatedModel.rotation.set(tilt, angle + modelOffsetAngle, 0);
            if (mixer) mixer.update(1 / 60); // Advance animation
        } else {
            token.position.set(currentX, y, currentZ);
            token.rotation.set(tilt, angle + modelOffsetAngle, 0);
        }

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // Land at correct board height
            if (animatedModel) {
                animatedModel.position.set(endPos.x, 1.5, endPos.z);
                animatedModel.rotation.set(0, angle + modelOffsetAngle, 0);
                if (action) action.stop();
                animatedModel.visible = false;
                token.position.copy(animatedModel.position);
                token.rotation.copy(animatedModel.rotation);
                token.visible = true;
                token.traverse(child => {
                    child.visible = true;
                });
            } else {
                token.position.set(endPos.x, 1.5, endPos.z);
                token.rotation.set(0, angle + modelOffsetAngle, 0);
            }
            // Clear movement flags for camera following
            isTokenMoving = false;
            currentlyMovingToken = null;
            if (callback) callback();
        }
    }

    animate();
}


// Helper function to handle movement completion
function finishMove(player, newPosition, passedGo) {
    // Update player position
    player.currentPosition = newPosition;

    // Handle passing GO
    if (passedGo && !player.inJail) {
        player.money += 200;
        showFeedback("Passed GO! Collect $200");
        updateMoneyDisplay();
    }

    const landingSpace = placeNames[newPosition] || "Unknown Space";
    const property = properties.find(p => p.name === landingSpace);

    // Check if we're in multiplayer mode
    const isMultiplayer = window.location.search.includes('room=') && window.location.search.includes('player=');
    const isCurrentPlayer = isMultiplayer ? 
        (window.multiplayerGame && (
            window.multiplayerGame.playerId === player.id || 
            window.multiplayerGame.playerId === player.id?.toString() ||
            window.multiplayerGame.playerId?.toString() === player.id?.toString()
        )) : 
        (player === players[currentPlayerIndex]);

    console.log(`finishMove debug - isMultiplayer: ${isMultiplayer}, isCurrentPlayer: ${isCurrentPlayer}, player.id: ${player.id}, window.multiplayerGame?.playerId: ${window.multiplayerGame?.playerId}`);
    console.log(`window.currentPlayerId:`, window.currentPlayerId);
    console.log(`player.id type:`, typeof player.id);
    console.log(`window.multiplayerGame?.playerId type:`, typeof window.multiplayerGame?.playerId);

    if (isCurrentPlayerAI()) {
        // AI action handling
        setTimeout(() => {
            switch (landingSpace) {
                case "Chance":
                case "Community Cards":
                    console.log(`AI landed on ${landingSpace}.`);
                    drawCard(landingSpace);
                    break;
                case "Income Tax":
                    handleIncomeTax(player);
                    break;
                case "Luxury Tax":
                    handleLuxuryTax(player);
                    break;
                case "GO TO JAIL":
                    console.log("AI landed on GO TO JAIL. Sending to Jail.");
                    goToJail(player);
                    setTimeout(() => endTurn(), 1500);
                    return;
                case "JAIL":
                    console.log("AI landed on Jail. Just visiting.");
                    setTimeout(() => endTurn(), 1500);
                    break;
                case "FREE PARKING":
                    console.log("AI landed on Free Parking. Taking a break.");
                    setTimeout(() => endTurn(), 1500);
                    break;
                default:
                    if (property) {
                        handleAIPropertyDecision(property);
                    }
            }
        }, 1500);
    } else {
        // Human player action handling
        hasMovedToken = true; // <-- Fix: set for human players
        switch (landingSpace) {
            case "Chance":
                drawCard("Chance");
                break;
            case "Community Cards":
                drawCard("Community Cards");
                break;
            case "Income Tax":
                handleIncomeTax(player);
                break;
            case "Luxury Tax":
                handleLuxuryTax(player);
                break;
            case "GO TO JAIL":
                console.log("Player landed on GO TO JAIL.");
                showGoToJailUI(player);
                return;
            case "JAIL":
                showJailUI(player);
                return;
            case "FREE PARKING":
                showFreeParkingUI(player);
                return;
            default:
                if (property && !player.inJail) {
                    // In multiplayer, only show UI to the current player
                    if (isMultiplayer) {
                        if (isCurrentPlayer) {
                            console.log(`Showing property UI for ${property.name} at position ${newPosition}`);
                            showPropertyUI(newPosition);
                        } else {
                            // Show notification to other players
                            if (window.multiplayerGame) {
                                window.multiplayerGame.showNotification(
                                    `${player.name} landed on ${property.name}`,
                                    'info'
                                );
                            }
                            hasHandledProperty = true;
                        }
                    } else {
                        // Single player mode
                        console.log(`Showing property UI for ${property.name} at position ${newPosition}`);
                        showPropertyUI(newPosition);
                    }
                    
                    // Fallback: If multiplayer check failed but we're in multiplayer mode, show UI anyway
                    if (isMultiplayer && !isCurrentPlayer && window.currentPlayerId === player.id) {
                        console.log(`Fallback: Showing property UI for ${property.name} at position ${newPosition}`);
                        showPropertyUI(newPosition);
                    }
                } else {
                    hasHandledProperty = true; // If no property or in jail, mark as handled
                }
        }
    }

    updateMoneyDisplay();
}

function showGoToJailUI(player) {
    const overlay = document.createElement('div');
    overlay.className = 'goto-jail-overlay';

    const popup = document.createElement('div');
    popup.className = 'goto-jail-popup';

    const header = document.createElement('div');
    header.className = 'popup-header';
    header.textContent = 'GO TO JAIL';

    const message = document.createElement('div');
    message.textContent = `${player.name}, you are being sent directly to Jail. Do not pass GO. Do not collect $200.`;

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'button-container';

    const continueButton = document.createElement('button');
    continueButton.className = 'action-button';
    continueButton.textContent = 'Continue';
    continueButton.onclick = () => {
        goToJail(player);
        closePopup(overlay);
        endTurn(); // End the turn after sending the player to jail
    };

    buttonContainer.appendChild(continueButton);
    popup.appendChild(header);
    popup.appendChild(message);
    popup.appendChild(buttonContainer);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
        popup.classList.add('fade-in');
    });

    // Automatically end the turn after a delay (optional, for smoother gameplay)
    setTimeout(() => {
        if (overlay.parentElement) {
            goToJail(player);
            closePopup(overlay);
            endTurn();
        }
    }, 5000); // Adjust delay as needed
}

function handleAIDecision(property) {
    if (!property) return;

    // Handle special properties
    if (property.type === "special") {
        handleAISpecialProperty(property);
        return;
    }

    // Handle regular properties
    if (!property.owner) {
        const shouldBuy = makeAIBuyDecision(players[currentPlayerIndex], property);
        if (shouldBuy) {
            buyProperty(players[currentPlayerIndex], property);
            showFeedback(`AI bought ${property.name}`);
        }
    }
}

function handleAISpecialProperty(property) {
    const currentPlayer = players[currentPlayerIndex];

    switch (property.name) {
        case "Chance":
            drawCard("Chance");
            break;
        case "Community Cards":
            drawCard("Community Cards");
            break;
    }
}

function handlePropertyLanding(player, position) {
    const propertyName = placeNames[position];
    const property = properties.find(p => p.name === propertyName);

    if (!property) {
        console.error(`No property found for position ${position}`);
        endTurn();
        return;
    }

    console.log(`${player.name} landed on: ${property.name}`, property);

    // Play horse galloping sound for Horseback Riding property
    if (property.name === "Horseback Riding") {
        horseGallopingSound.currentTime = 0;
        horseGallopingSound.playbackRate = 0.6; // Slow down for serene effect
        horseGallopingSound.play().catch(() => {});
    }

    // Handle "JAIL" property
    if (property.name === "JAIL") {
        if (player.inJail) {
            console.log(`${player.name} is in Jail for ${player.jailTurns} more turn(s).`);
            showJailUI(player);
        } else {
            console.log(`${player.name} is just visiting Jail.`);
            showJailUI(player);
        }
        return;
    }

    // Handle Income Tax
    if (property.name === "Income Tax") {
        handleIncomeTax(player);
        return;
    }

    // Handle Luxury Tax
    if (property.name === "Luxury Tax") {
        handleLuxuryTax(player);
        return;
    }

    // Handle GO TO JAIL
    if (property.name === "GO TO JAIL") {
        console.log(`${player.name} landed on GO TO JAIL`);
        goToJail(player);
        return;
    }

    // Handle FREE PARKING
    if (property.name === "FREE PARKING") {
        console.log(`${player.name} landed on FREE PARKING`);
        showFreeParkingUI(player);
        return;
    }

    // Handle Chance and Community Chest
    if (property.name === "Chance" || property.name === "Community Cards") {
        drawCard(property.name);
        return;
    }

    // Handle property ownership scenarios
    if (property.owner && property.owner !== player) {
        console.log(`${player.name} landed on ${property.name}, owned by ${property.owner.name}`);

        // Handle utilities differently
        if (property.type === "utility") {
            handleUtilitySpace(player, property);
            return;
        }

        // Handle railroads differently
        if (property.type === "railroad") {
            handleRailroadSpace(player, property);
            return;
        }

        // Handle ticket/concert properties: do NOT pay rent
        if (ticketProperties.includes(property.name)) {
            showPropertyUI(position);
            return;
        }
        // Handle regular properties
        const rentAmount = calculateRent(property);
        if (isCurrentPlayerAI()) {
            // Show property popup for AI so players can see the rent payment
            showPropertyUI(position);
            // Then handle rent payment after a short delay
            setTimeout(() => {
                handleRentPayment(player, property);
            }, 2000); // Show popup for 2 seconds before AI pays rent
        } else {
            showPropertyUI(position);
        }
    } else if (!property.owner) {
        // Property is unowned
        console.log(`${player.name} landed on unowned property: ${property.name}`);
        if (isCurrentPlayerAI()) {
            // Show property popup for AI so players can see what the AI is deciding on
            showPropertyUI(position);
            // Then handle AI decision after a short delay
            setTimeout(() => {
                handleAIPropertyDecision(property, () => {
                    setTimeout(() => endTurn(), 1500);
                });
            }, 2000); // Show popup for 2 seconds before AI makes decision
        } else {
            showPropertyUI(position);
        }
    } else {
        // Player owns the property
        console.log(`${player.name} landed on their own property: ${property.name}`);
        if (!isCurrentPlayerAI()) {
            showPropertyUI(position);
        } else {
            setTimeout(() => endTurn(), 1500);
        }
    }

    // Update displays
    updateMoneyDisplay();
    updateBoards();

    // Check for bankruptcy after any money-related actions
    if (player.money < 0) {
        console.log(`${player.name} is bankrupt!`);
        handleBankruptcy(player, property.owner);
        return;
    }
}

function calculateRailroadRent(property) {
    const railroadCount = property.owner.properties.filter(p => p.type === "railroad").length;
    return property.rentWithRailroads[railroadCount - 1];
}

function handleSpecialSpace(player, property) {
    switch (property.name) {
        case "Chance":
            drawCard("Chance");
            break;
        case "Community Cards":
            drawCard("Community Chest");
            break;
        case "Income Tax":
            handleIncomeTax(player);
            break;
        case "Luxury Tax":
            handleLuxuryTax(player);
            break;
        case "GO TO JAIL":
            goToJail(player);
            break;
        case "FREE PARKING":
            showFeedback("Free Parking - Take a break!");
            endTurn(); // End the turn immediately
            break;
        default:
            console.error(`Unhandled special space: ${property.name}`);
    }
}

function handleAIChanceCard() {
    const card = chanceCards[Math.floor(Math.random() * chanceCards.length)];
    showAIDecision(`AI draws a Chance card`);
    setTimeout(() => {
        applyCardEffect(card);
    }, 1000);
}

function handleAICommunityCard() {
    const card = communityChestCards[Math.floor(Math.random() * communityChestCards.length)];
    showAIDecision(`AI draws a Community Chest card`);
    setTimeout(() => {
        applyCardEffect(card);
    }, 1000);
}

function showIncomeTaxUI(player) {
    const overlay = document.createElement('div');
    overlay.className = 'income-tax-overlay';

    const popup = document.createElement('div');
    popup.className = 'income-tax-popup';

    const header = document.createElement('div');
    header.className = 'popup-header';
    header.textContent = 'Income Tax';

    const message = document.createElement('div');
    message.className = 'income-tax-message';
    message.textContent = `${player.name}, you must pay $200 or 10% of your total worth.`;

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'button-container';

    const pay200Button = document.createElement('button');
    pay200Button.className = 'action-button pay';
    pay200Button.textContent = 'Pay $200';
    pay200Button.onclick = () => {
        if (player.money >= 200) {
            player.money -= 200;
            showFeedback("You paid $200 in Income Tax.");
            updateMoneyDisplay();
        } else {
            showFeedback("Not enough money to pay!");
        }
        closePopup(overlay);
    };

    const pay10PercentButton = document.createElement('button');
    pay10PercentButton.className = 'action-button pay';
    pay10PercentButton.textContent = 'Pay 10%';
    pay10PercentButton.onclick = () => {
        const taxAmount = Math.floor(player.money * 0.1);
        if (player.money >= taxAmount) {
            player.money -= taxAmount;
            showFeedback(`You paid $${taxAmount} in Income Tax.`);
            updateMoneyDisplay();
        } else {
            showFeedback("Not enough money to pay!");
        }
        if (overlay) {
            closePopup(overlay);
        } else {
            console.error("Overlay is undefined or null.");
        }
    };

    const closeButton = document.createElement('button');
    closeButton.className = 'action-button close';
    closeButton.textContent = 'Close';
    closeButton.onclick = () => closePopup(overlay);

    buttonContainer.appendChild(pay200Button);
    buttonContainer.appendChild(pay10PercentButton);
    buttonContainer.appendChild(closeButton);
    popup.appendChild(header);
    popup.appendChild(message);
    popup.appendChild(buttonContainer);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
        popup.classList.add('fade-in');
    });
}

function makeAIMortgageDecision(player, property) {
    // AI logic for mortgage/unmortgage decisions
    if (player.money < 150 && !property.mortgaged) {
        // Mortgage if low on money
        mortgageProperty(player, property);
        showAIDecision(`AI mortgages ${property.name} for emergency funds`);
    } else if (player.money >= property.mortgageValue * 1.5 && property.mortgaged) {
        // Unmortgage if has plenty of money
        unmortgageProperty(player, property);
        showAIDecision(`AI unmortgages ${property.name}`);
    }
}

function hasMonopolyPotential(player, property) {
    if (!property.color) return false;

    const sameColorProperties = properties.filter(p => p.color === property.color);
    const ownedCount = sameColorProperties.filter(p => p.owner === player).length;
    const unownedCount = sameColorProperties.filter(p => !p.owner).length;

    // Return true if AI already owns some properties of this color or many are available
    return ownedCount > 0 || unownedCount >= sameColorProperties.length - 1;
}

function isStrategicLocation(property) {
    // Define strategic locations (e.g., properties near corners, utilities, railroads)
    const strategicIndices = [1, 3, 5, 15, 25, 35]; // Example indices
    return strategicIndices.includes(placeNames.indexOf(property.name));
}

function showAIDecision(message) {
    const decision = document.createElement('div');
    decision.className = 'ai-decision';
    decision.textContent = message;
    document.body.appendChild(decision);

    // Animate decision message
    requestAnimationFrame(() => {
        decision.style.opacity = '1';
        decision.style.transform = 'translateY(0)';
    });

    // Remove after delay
    setTimeout(() => {
        decision.style.opacity = '0';
        decision.style.transform = 'translateY(-20px)';
        setTimeout(() => decision.remove(), 300);
    }, 2000);
}

function handleAIJailTurn(player) {
    if (player.jailTurns > 0) {
        if (player.money >= 50) {
            showAIPopup(`${player.name} pays $50 to get out of Jail`);
            player.money -= 50;
            player.inJail = false;
            player.jailTurns = 0;
        } else if (player.cards.includes("Get Out of Jail Free")) {
            showAIPopup(`${player.name} uses a Get Out of Jail Free card`);
            player.cards.splice(player.cards.indexOf("Get Out of Jail Free"), 1);
            player.inJail = false;
            player.jailTurns = 0;
        } else {
            const roll1 = Math.ceil(Math.random() * 6);
            const roll2 = Math.ceil(Math.random() * 6);
            showAIPopup(`${player.name} rolls for doubles: ${roll1} & ${roll2}`);
            if (roll1 === roll2) {
                showAIPopup(`${player.name} rolled doubles and gets out of Jail!`);
                player.inJail = false;
                player.jailTurns = 0;
            } else {
                player.jailTurns -= 1;
                showAIPopup(`${player.name} failed to roll doubles. ${player.jailTurns} turn(s) left.`);
            }
        }
    }
    if (player.jailTurns === 0) {
        player.inJail = false;
    }
    endTurn();
}

function isCurrentPlayerAI() {
    // Check if we're in multiplayer mode
    const isMultiplayer = window.location.search.includes('room=') && window.location.search.includes('player=');
    
    if (isMultiplayer) {
        // In multiplayer mode, check if the current player is AI
        if (window.multiplayerGame && window.multiplayerGame.playerId) {
            const currentPlayer = window.players ? window.players.find(p => 
                p.id === window.multiplayerGame.playerId || 
                p.id === window.multiplayerGame.playerId.toString() ||
                p.id?.toString() === window.multiplayerGame.playerId?.toString()
            ) : null;
            if (currentPlayer) {
                const isAI = currentPlayer.isAI || aiPlayers.has(currentPlayer.tokenName);
                console.log(`isCurrentPlayerAI multiplayer debug - currentPlayer:`, currentPlayer, `isAI: ${isAI}`);
                return isAI;
            }
        }
        console.log(`isCurrentPlayerAI multiplayer debug - no current player found`);
        return false;
    } else {
        // Single player mode
        const currentPlayer = players[currentPlayerIndex];
        if (!currentPlayer) {
            return false;
        }
        // Check both the `isAI` flag and the `aiPlayers` set
        const isAI = currentPlayer.isAI || aiPlayers.has(currentPlayer.tokenName);
        console.log(`isCurrentPlayerAI single player debug - currentPlayer:`, currentPlayer, `isAI: ${isAI}`);
        return isAI;
    }
}

function makeAIBuyDecision(player, property) {
    if (!player || !property) {
        console.error("Invalid player or property in makeAIBuyDecision");
        return false;
    }

    try {
        // Check if this is a ticket property
        const isTicketProperty = ticketProperties.includes(property.name);
        
        // Sophisticated AI decision making for purchasing properties
        const factors = {
            hasEnoughMoney: player.money >= (property.price || 0) * 2,
            isGoodValue: (property.price || 0) <= 200,
            hasMonopolyPotential: hasMonopolyPotential(player, property),
            isStrategicLocation: isStrategicLocation(property),
            isTicketProperty: isTicketProperty,
            randomChance: Math.random() > 0.3
        };

        // Special handling for ticket properties
        if (isTicketProperty) {
            // AI is more likely to buy ticket properties if they have enough money
            // Ticket properties are experiences/entertainment, so AI should be more willing to buy them
            const ticketScore = (factors.hasEnoughMoney ? 3 : 0) +
                (factors.isGoodValue ? 2 : 0) +
                (factors.randomChance ? 1 : 0);
            
            return ticketScore >= 3; // Lower threshold for ticket properties
        }

        // Regular property scoring
        const score = (factors.hasEnoughMoney ? 2 : 0) +
            (factors.isGoodValue ? 1.5 : 0) +
            (factors.hasMonopolyPotential ? 3 : 0) +
            (factors.isStrategicLocation ? 2 : 0) +
            (factors.randomChance ? 0.5 : 0);

        return score >= 4;
    } catch (error) {
        console.error("Error in makeAIBuyDecision:", error);
        return false;
    }
}

function handleFreeParking(player) {
    showFeedback("Free Parking - Take a break!");
    // Add any house rules for Free Parking here
}

function handleUtilityLanding(player, property) {
    if (!property.owner) {
        if (!isCurrentPlayerAI()) {
            showPropertyUI(player.currentPosition);
        }
    } else if (property.owner !== player) {
        const diceRoll = Math.ceil(Math.random() * 6) + Math.ceil(Math.random() * 6);
        const rentAmount = calculateUtilityRent(property, diceRoll);
        showFeedback(`Rolled ${diceRoll} for utility rent`);
        setTimeout(() => payRent(player, property.owner, rentAmount), 1000);
    }
}

function calculateUtilityRent(property, diceRoll) {
    const utilityCount = property.owner.properties.filter(p => p.type === "utility").length;
    return utilityCount === 1 ? diceRoll * 4 : diceRoll * 10;
}

function calculateAndPayRent(player, property) {
    const rentAmount = calculateRent(property);
    payRent(player, property.owner, rentAmount);
}

function calculateRent(property) {
    let rent = property.rent;

    // Check for monopoly
    if (hasMonopoly(property.owner, property)) {
        rent *= 3; // Increase monopoly multiplier from 2 to 3
        console.log(`Rent tripled to $${rent} due to monopoly`);
    }

    // Add house/hotel rents
    if (property.houses > 0) {
        rent = property.rentWithHouse[property.houses - 1] * 1.5; // Increase house rent by 50%
        console.log(`Rent adjusted to $${rent} due to ${property.houses} houses`);
    } else if (property.hotel) {
        rent = property.rentWithHotel * 1.5; // Increase hotel rent by 50%
        console.log(`Rent adjusted to $${rent} due to hotel`);
    }

    return rent;
}

function hasMonopoly(player, property) {
    if (!property.color) return false;

    const sameColorProperties = properties.filter(p => p.color === property.color);
    return sameColorProperties.every(p => p.owner === player);
}

// Helper function to get player colors
function getPlayerColor(playerIndex) {
    const colors = [
        0x00ff00, // Green
        0x0000ff, // Blue
        0xff0000, // Red
        0xffff00 // Yellow
    ];
    return colors[playerIndex] || colors[0];
}

function showAIPopup(message, duration = 1800) {
    const popup = document.createElement('div');
    popup.className = 'ai-action-popup';
    popup.textContent = message;
    popup.style.position = 'fixed';
    popup.style.top = '60px';
    popup.style.right = '40px';
    popup.style.background = 'rgba(30,30,30,0.93)';
    popup.style.color = '#fff';
    popup.style.padding = '16px 28px';
    popup.style.borderRadius = '10px';
    popup.style.fontSize = '17px';
    popup.style.zIndex = 9999;
    popup.style.boxShadow = '0 4px 16px rgba(0,0,0,0.25)';
    popup.style.opacity = '0';
    popup.style.transition = 'opacity 0.3s, transform 0.3s';
    popup.style.transform = 'translateY(-20px)';
    document.body.appendChild(popup);

    setTimeout(() => {
        popup.style.opacity = '1';
        popup.style.transform = 'translateY(0)';
    }, 50);

    setTimeout(() => {
        popup.style.opacity = '0';
        popup.style.transform = 'translateY(-20px)';
        setTimeout(() => popup.remove(), 300);
    }, duration);
}


function getTokenImageUrl(tokenName) {
    const imageUrls = {
        "hat": "Images/image-removebg-preview (6).png",
        "woman": "Images/image-removebg-preview (8).png",
        "rolls royce": "Images/image-removebg-preview.png",
        "speed boat": "Images/image-removebg-preview (3).png",
        "football": "Images/image-removebg-preview (7).png",
        // FIXED: Use correct folder and image name for helicopter
        "helicopter": "Images/image-removebg-preview (1).png",
        "burger": "Images/image-removebg-preview (9).png",
        "nike": "Images/image-removebg-preview (10).png"
    };
    return imageUrls[tokenName] || "";
}

function selectToken(tokenName) {
    scene.traverse((object) => {
        if (object.userData.isToken && object.userData.tokenName === tokenName) {
            selectedToken = object;
            players[currentPlayerIndex].selectedToken = selectedToken;
            selectedToken.visible = true; // <-- Ensure token is visible!
            console.log('[TokenAssign] Assigned token to player', players[currentPlayerIndex]);
            console.log('[TokenAssign] Token object:', selectedToken, '| Visible:', selectedToken.visible, '| In scene:', !!selectedToken.parent, '| Position:', selectedToken.position);

            object.traverse((child) => {
                if (child.isMesh) {
                    child.material = child.material.clone();
                    child.material.emissiveIntensity = 0.5;
                    child.material.needsUpdate = true;
                }
            });
            // --- Camera zoom in on token selection ---
            if (camera && controls && selectedToken) {
                camera.position.set(
                    selectedToken.position.x + 3,
                    selectedToken.position.y + 5,
                    selectedToken.position.z + 3
                );
                controls.update();
            }
        }
    });

    if (tokenSelectionUI) {
        tokenSelectionUI.style.opacity = "0";
        tokenSelectionUI.style.transition = "opacity 0.5s";
        setTimeout(() => {
            document.body.removeChild(tokenSelectionUI);
            tokenSelectionUI = null;
        }, 500);
    }

    nextPlayer(); // Call next player here
    
    // Update video chat if it's active
    if (typeof updateVideoChatForGameState === 'function') {
        updateVideoChatForGameState();
    }
}

function init() {
    // Check if we're in multiplayer mode first
    checkMultiplayerMode();
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    setupCameraFollowToggle();
    updateCameraFollowUI();

    // Main camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1500);
    // Default zoomed-out camera position
    camera.position.set(0, 40, 0);
    camera.rotation.x = -Math.PI / 2;

    // Follow camera
    followCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1500);

    renderer = new THREE.WebGLRenderer({
        antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    // Use OrbitControls for the main camera
    controls = new OrbitControls(camera, renderer.domElement);

    function setupCameraFollowToggle() {
        if (document.getElementById('camera-follow-toggle')) return;
        const btn = document.createElement('button');
        btn.id = 'camera-follow-toggle';
        btn.innerText = 'Follow Token (F)';
        btn.style.position = 'fixed';
        btn.style.top = '80px';
        btn.style.left = '50%';
        btn.style.transform = 'translateX(-50%)';
        btn.style.zIndex = '2002';
        btn.style.background = '#222';
        btn.style.color = '#fff';
        btn.style.padding = '10px 18px';
        btn.style.borderRadius = '8px';
        btn.style.fontSize = '15px';
        btn.style.opacity = '0.85';
        btn.style.border = 'none';
        btn.style.cursor = 'pointer';
        btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.18)';
        btn.onclick = toggleCameraFollowMode;
        document.body.appendChild(btn);

        const indicator = document.createElement('div');
        indicator.id = 'camera-follow-indicator';
        indicator.innerText = 'FOLLOWING TOKEN';
        indicator.style.position = 'fixed';
        indicator.style.top = '120px';
        indicator.style.left = '50%';
        indicator.style.transform = 'translateX(-50%)';
        indicator.style.zIndex = '2002';
        indicator.style.background = '#4caf50';
        indicator.style.color = '#fff';
        indicator.style.padding = '6px 18px';
        indicator.style.borderRadius = '8px';
        indicator.style.fontSize = '14px';
        indicator.style.fontWeight = 'bold';
        indicator.style.opacity = '0.92';
        indicator.style.display = 'none';
        indicator.style.boxShadow = '0 2px 8px rgba(0,0,0,0.18)';
        document.body.appendChild(indicator);
    }

    // Initialize the advanced pathfinding system
    initializePathfinding();
    
    setupLighting();
    createBoard();
    createProperties();

    // Call createImageCarousel here, after the scene is initialized
    createImageCarousel(images, {
        x: 0,
        y: 1.5,
        z: 0
    }); // Position in the middle of the board

    createTokens(() => {
        // Only create token selection UI if not in multiplayer mode
        if (!window.isMultiplayerMode) {
            createPlayerTokenSelectionUI(currentPlayerIndex);
        }
        
        // Initialize multiplayer if needed
        if (isMultiplayerMode) {
            initializeMultiplayerGame();
        }
    });

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    popupGroup = new THREE.Group();
    scene.add(popupGroup);

    window.addEventListener("click", onTokenClick);
    window.addEventListener("resize", onWindowResize, false);
    window.addEventListener("click", onPropertyClick);

    // Main animation loop
    function animate() {
        requestAnimationFrame(animate);
        
        const delta = clock.getDelta();
        
        // Update all animation mixers
        scene.traverse((object) => {
            if (object.userData && object.userData.mixer) {
                object.userData.mixer.update(delta);
            }
            if (object.userData && object.userData.idleMixer) {
                object.userData.idleMixer.update(delta);
            }
            if (object.userData && object.userData.walkMixer) {
                object.userData.walkMixer.update(delta);
            }
        });
        
        // Update camera follow if enabled
        if (cameraFollowMode && !userIsMovingCamera) {
            const token = getCurrentPlayerToken();
            if (token) {
                controls.target.lerp(token.position, 0.1);
                const targetPosition = new THREE.Vector3(
                    token.position.x + 4,
                    token.position.y + 7,
                    token.position.z + 4
                );
                camera.position.lerp(targetPosition, 0.1);
                controls.update();
            }
        }
        
        renderer.render(scene, camera);
    }
    
    animate();
    initializePlayers();
    validateGameState();
    
    // Initialize video chat system
    initVideoChat();
    
    // Only create token selection UI if not in multiplayer mode
    if (!window.isMultiplayerMode) {
        createPlayerTokenSelectionUI(currentPlayerIndex);
    }
    
    createDiceButton();
    startGameTimer();
    // updatePropertyManagementBoard(players[currentPlayerIndex]); // Not needed for multiplayer
    // If selectedToken exists, zoom in on it
    if (selectedToken) {
        camera.position.set(
            selectedToken.position.x + 3,
            selectedToken.position.y + 5,
            selectedToken.position.z + 3
        );
        controls.update();
    }
}

function createImageCarousel(images, position) {
    if (!scene) {
        console.error("Scene is not initialized. Ensure the scene is created before calling createImageCarousel.");
        return;
    }

    const carouselGroup = new THREE.Group();
    const planeGeometry = new THREE.PlaneGeometry(60, 60);

    let currentImageIndex = 0;
    let carouselTimeout = null;
    let gifImg = null; // For animated GIFs
    let baseplate = null; // <-- Add this line

    // Create a single plane for the carousel
    const material = new THREE.MeshBasicMaterial({
        side: THREE.DoubleSide
    });
    const plane = new THREE.Mesh(planeGeometry, material);
    plane.rotation.x = -Math.PI / 2;
    carouselGroup.add(plane);

    carouselGroup.position.set(position.x, position.y, position.z);
    scene.add(carouselGroup);

    function spawnBaseplate() {
        if (baseplate) return; // Already exists
        const baseGeometry = new THREE.BoxGeometry(62, 1, 62); // Slightly larger than image
        const baseMaterial = new THREE.MeshPhongMaterial({
            color: 0x222222,
            shininess: 30,
            opacity: 0.85,
            transparent: true
        });
        baseplate = new THREE.Mesh(baseGeometry, baseMaterial);
        baseplate.position.set(
            carouselGroup.position.x,
            carouselGroup.position.y - 1, // Just below the carousel
            carouselGroup.position.z
        );
        baseplate.receiveShadow = true;
        scene.add(baseplate);
    }

    function removeBaseplate() {
        if (baseplate) {
            scene.remove(baseplate);
            baseplate.geometry.dispose();
            baseplate.material.dispose();
            baseplate = null;
        }
    }

    function updateImage() {
        if (carouselTimeout) clearTimeout(carouselTimeout);

        const currentImage = images[currentImageIndex];

        // Remove baseplate by default
        removeBaseplate();

        // If previous GIF image exists, remove its animation loop
        if (gifImg) {
            gifImg = null;
        }

        // If it's a GIF, use <img> so browser animates it
        if (currentImage.endsWith('.gif')) {
            gifImg = document.createElement('img');
            gifImg.src = currentImage;
            gifImg.crossOrigin = "anonymous";
            gifImg.onload = () => {
                const texture = new THREE.Texture(gifImg);
                texture.needsUpdate = true;
                material.map = texture;
                material.needsUpdate = true;

                // Animate the GIF by updating the texture every frame
                function animateGifTexture() {
                    if (material.map && gifImg) {
                        material.map.needsUpdate = true;
                        requestAnimationFrame(animateGifTexture);
                    }
                }
                animateGifTexture();

                // --- SPAWN BASEPLATE ONLY FOR GIF ---
                spawnBaseplate();

                // Set how long to show the GIF (default: 6s, or adjust as needed)
                carouselTimeout = setTimeout(nextImage, 6000);
            };
        } else {
            // For static images, use TextureLoader
            const textureLoader = new THREE.TextureLoader();
            textureLoader.load(currentImage, (loadedTexture) => {
                material.map = loadedTexture;
                material.needsUpdate = true;
            });
            carouselTimeout = setTimeout(nextImage, 3000);
        }
    }

    function nextImage() {
        // Remove baseplate when switching away from GIF
        removeBaseplate();
        currentImageIndex = (currentImageIndex + 1) % images.length;
        updateImage();
    }

    updateImage();
}

function checkGameEnd() {
    let activePlayers = players.filter(player => player.money > 0).length;

    if (activePlayers <= 1) {
        alert("Game Over! " + players.find(player => player.money > 0).name + " wins!");
        resetGame();
    }
}

function resetGame() {
    players.forEach(player => {
        player.money = 5000;
        player.properties = [];
        player.currentPosition = 0;
        player.tokenName = null;
        player.selectedToken = null;
    });
    startGame(); // Redirect to the home screen or restart the game
}

function startGame() {
    window.location.href = 'home.html'; // Redirects back to home screen
}

function checkBankruptcy(player) {
    if (player.money < 0) {
        alert(`${player.name} is bankrupt and out of the game!`);
        players = players.filter(p => p !== player);
        if (players.length === 1) {
            alert(`Game Over! ${players[0].name} wins!`);
            resetGame();
        }
    }
}

function tradeProperty(fromPlayer, toPlayer, property, amount) {
    if (fromPlayer.properties.includes(property) && toPlayer.money >= amount) {
        fromPlayer.properties.splice(fromPlayer.properties.indexOf(property), 1);
        fromPlayer.money += amount;
        toPlayer.properties.push(property);
        toPlayer.money -= amount;
        alert(`${toPlayer.name} bought ${property.name} from ${fromPlayer.name} for $${amount}`);
        updateMoneyDisplay();
    }
}

function mortgageProperty(player, property) {
    if (property.houses > 0 || property.hotel) {
        showFeedback("Sell all houses and hotels before mortgaging this property!");
        return;
    }

    if (!property.mortgaged) {
        player.money += property.mortgageValue;
        property.mortgaged = true;
        showFeedback(`${property.name} has been mortgaged for $${property.mortgageValue}`);
        updateMoneyDisplay();
        updatePropertyManagementBoard(player);
    }
}

function goToJail(player) {
    const jailPosition = placeNames.findIndex(name => name === "JAIL");
    player.currentPosition = jailPosition;
    player.inJail = true;
    player.jailTurns = 2; // Stay in jail for 2 turns

    // Update token position tracking for pathfinding
    if (player.selectedToken) {
        updateTokenPosition(player.selectedToken, jailPosition);
    }

    showFeedback(`${player.name} is sent to Jail!`);
    endTurn(); // End the turn immediately
}

function useGetOutOfJailFreeCard(player) {
    const card = player.cards.find(c => c === "Get Out of Jail Free");
    if (card) {
        player.cards.splice(player.cards.indexOf(card), 1);
        player.inJail = false;
        alert(`${player.name} used a Get Out of Jail Free card`);
    }
}

function createTradeUI() {
    const tradeUI = document.getElementById("trade-ui");
    const fromPlayerSelect = document.getElementById("from-player-select");
    const toPlayerSelect = document.getElementById("to-player-select");

    fromPlayerSelect.innerHTML = players.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
    toPlayerSelect.innerHTML = players.map(p => `<option value="${p.name}">${p.name}</option>`).join('');

    document.getElementById("trade-button").onclick = () => {
        const fromPlayerName = fromPlayerSelect.value;
        const toPlayerName = toPlayerSelect.value;
        const fromPlayer = players.find(p => p.name === fromPlayerName);
        const toPlayer = players.find(p => p.name === toPlayerName);

        // Example trade logic, replace with more complex logic as needed
        const tradeSuccessful = tradeProperty(fromPlayer, toPlayer, fromPlayer.properties[0], 100);
        const tradeStatus = document.getElementById("trade-status");
        tradeStatus.textContent = tradeSuccessful ? "Trade Successful!" : "Trade Failed!";
    };

    tradeUI.style.display = "block";
}

function createMortgageUI() {
    const propertyUI = getPropertyUI(); // Assume this function gets the relevant property UI element

    const mortgageButton = document.createElement("button");
    mortgageButton.textContent = "Mortgage Property";
    mortgageButton.onclick = () => {
        const currentPlayer = players[currentPlayerIndex];
        const property = currentPlayer.properties[0]; // Assume a method to get the selected property
        mortgageProperty(currentPlayer, property);
    };

    const unmortgageButton = document.createElement("button");
    unmortgageButton.textContent = "Unmortgage Property";
    unmortgageButton.onclick = () => {
        const currentPlayer = players[currentPlayerIndex];
        const property = currentPlayer.properties[0]; // Assume a method to get the selected property
        unmortgageProperty(currentPlayer, property);
    };

    propertyUI.appendChild(mortgageButton);
    propertyUI.appendChild(unmortgageButton);
}

function onPlayerTurn() {
    const currentPlayer = players[currentPlayerIndex];

    console.log(`It's ${currentPlayer.name}'s turn!`);

    // Display Jail Options if the player is in jail
    if (currentPlayer.inJail) {
        createJailOptionsUI(currentPlayer);
    } else {
        // Check if player is on a property space and handle property-specific actions
        const currentSpace = positions[currentPlayer.currentPosition];
        const positionIndex = positions.indexOf(currentSpace);
        const placeName = placeNames[positionIndex];
        const property = properties.find(p => p.name === placeName);

        if (property && property.videoUrls && property.videoUrls.length > 0) {
            const videoContainer = document.createElement('div');
            videoContainer.className = 'property-video-container';
            videoContainer.style.width = '200px';
            videoContainer.style.height = '150px';
            videoContainer.style.overflow = 'hidden';
            videoContainer.style.borderRadius = '8px';
            videoContainer.style.marginBottom = '10px';
            videoContainer.style.position = 'relative';

            // Randomly select one of the video URLs
            const randomIndex = Math.floor(Math.random() * property.videoUrls.length);
            const selectedUrl = property.videoUrls[randomIndex];

            const video = document.createElement('video');
            video.src = selectedUrl;
            video.controls = true;
            video.autoplay = false;
            video.muted = true;
            video.style.width = '100%';
            video.style.height = '100%';
            video.style.objectFit = 'cover';

            videoContainer.appendChild(video);
            content.appendChild(videoContainer);
        } else {
            // Handle property UI and other space specific logic
            showPropertyUI(currentPlayer.currentPosition);
        }
    }

    // Offer trade options
    if (currentPlayer.properties.length > 0) {
        createTradeUI();
    }

    // Check for things like "Go to Jail" spaces
    if (placeNames[currentPlayer.currentPosition] === "GO TO JAIL") {
        goToJail(currentPlayer);
    }
}


// Add these functions to implement complete Monopoly money system

function handlePassingGo(player) {
    player.money += 400; // Increased from $200 to $400
    showFeedback(`${player.name} passed GO! Collected $400`);
    updateMoneyDisplay();
}

function checkPassingGo(oldPosition, newPosition) {
    // Check if player passed GO by comparing old and new positions
    if (oldPosition > newPosition) {
        return true;
    }
    return false;
}

function handleBankruptcy(bankruptPlayer, creditorPlayer, amountOwed) {
    showFeedback(`${bankruptPlayer.name} is bankrupt!`);

    // Transfer all properties to creditor
    bankruptPlayer.properties.forEach(property => {
        property.owner = creditorPlayer;
        creditorPlayer.properties.push(property);
    });

    // Transfer all money
    creditorPlayer.money += bankruptPlayer.money;
    bankruptPlayer.money = 0;

    // Remove bankrupt player from game
    players = players.filter(p => p !== bankruptPlayer);

    checkGameEnd();
}

const DICE_POSITION = {
    x: 0, // Center of board
    y: 1.5, // Just above board surface
    z: 0 // Center of board
};

function createDiceButton() {
    if (!document.querySelector('.dice-button')) {
        const rollButton = document.createElement('button');
        rollButton.className = 'dice-button';
        rollButton.textContent = 'Roll Dice';

        // Only set display and z-index, let CSS handle the rest
        rollButton.style.display = 'none';
        rollButton.style.zIndex = '2001'; // Make sure it's above most UI

        // Touch and click support
        rollButton.addEventListener('click', rollDice);
        rollButton.addEventListener('touchstart', function(e) {
            e.preventDefault();
            rollDice();
        });

        document.body.appendChild(rollButton);
    }
}

function createDie(number) {
    const dieGeometry = new THREE.BoxGeometry(2, 2, 2);
    const materials = [];

    // Create all 6 faces
    for (let i = 0; i < 6; i++) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const context = canvas.getContext('2d');

        // White background
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, 128, 128);
        context.fillStyle = '#000000';

        // Draw dots ONLY for the number we want (front face)
        if (i === 0) {
            drawDots(context, number);
        }

        const texture = new THREE.CanvasTexture(canvas);
        materials.push(new THREE.MeshBasicMaterial({
            map: texture
        }));
    }

    const die = new THREE.Mesh(dieGeometry, materials);
    die.castShadow = true;
    return die;
}

function drawDots(context, number) {
    const positions = {
        1: [
            [64, 64]
        ],
        2: [
            [32, 32],
            [96, 96]
        ],
        3: [
            [32, 32],
            [64, 64],
            [96, 96]
        ],
        4: [
            [32, 32],
            [32, 96],
            [96, 32],
            [96, 96]
        ],
        5: [
            [32, 32],
            [32, 96],
            [64, 64],
            [96, 32],
            [96, 96]
        ],
        6: [
            [32, 32],
            [32, 64],
            [32, 96],
            [96, 32],
            [96, 64],
            [96, 96]
        ]
    };

    const dots = positions[number] || [];
    dots.forEach(([x, y]) => {
        context.beginPath();
        context.arc(x, y, 10, 0, Math.PI * 2);
        context.fill();
    });
}

function rollDice() {
    if (!allowedToRoll || isTokenMoving || isTurnInProgress) {
        console.log("Cannot roll dice while token is moving or turn is in progress.");
        return;
    }

    allowedToRoll = false; // Prevent further rolls until this one is done
    isTurnInProgress = true; // Mark the turn as in progress
    hasTakenAction = true; // Mark that the player has taken an action

    // Create dice rolling sound
    const rollSound = new Audio('Sounds/dice-142528.mp3');
    rollSound.volume = 0.5;
    rollSound.play().catch(error => console.log("Audio play failed:", error));

    // Generate the roll numbers
    const roll1 = Math.floor(Math.random() * 6) + 1;
    const roll2 = Math.floor(Math.random() * 6) + 1;
    const total = roll1 + roll2;
    console.log(`Dice rolled: ${roll1} and ${roll2} (Total: ${total})`);

    // Create dice with these numbers
    const dice1 = createDie(roll1);
    const dice2 = createDie(roll2);

    // Position dice
    dice1.position.set(DICE_POSITION.x - 2, DICE_POSITION.y, DICE_POSITION.z);
    dice2.position.set(DICE_POSITION.x + 2, DICE_POSITION.y, DICE_POSITION.z);

    scene.add(dice1);
    scene.add(dice2);

    let rotations = 0;
    const maxRotations = 2.5; // Faster

    const animate = () => {
        if (rotations < maxRotations) {
            dice1.rotation.x += Math.random() * 0.4;
            dice1.rotation.y += Math.random() * 0.4;
            dice1.rotation.z += Math.random() * 0.4;
            dice2.rotation.x += Math.random() * 0.4;
            dice2.rotation.y += Math.random() * 0.4;
            dice2.rotation.z += Math.random() * 0.4;
            rotations += 0.2; // Faster increment
            requestAnimationFrame(animate);
        } else {
            dice1.rotation.set(0, 0, Math.PI / 2);
            dice2.rotation.set(0, 0, Math.PI / 2);

            showDiceResult(total, roll1, roll2);

            setTimeout(() => {
                scene.remove(dice1);
                scene.remove(dice2);
                moveTokenToNewPositionWithCollisionAvoidance(total, () => {
                    isTurnInProgress = false;
                });
            }, 1500); // Shorter delay
        }
    };

    animate();
}

function logTurnDetails() {
    console.log(`Current Player: ${players[currentPlayerIndex].name}`);
    console.log(`isTurnInProgress: ${isTurnInProgress}`);
    console.log(`allowedToRoll: ${allowedToRoll}`);
}

function handlePlayerInJail(player) {
    if (player.jailTurns > 0) {
        console.log(`${player.name} is in Jail. Skipping turn.`);
        player.jailTurns -= 1;

        if (player.jailTurns === 0) {
            player.inJail = false; // Release the player after their jail turns are over
            console.log(`${player.name} is released from Jail.`);
        }

        setTimeout(() => {
            isTurnInProgress = false; // Mark the turn as complete
            endTurn(); // Skip the turn automatically
        }, 2000);
    }
}

// Advanced Pathfinding System
let tokenPositions = new Map(); // Track where each token is currently positioned
let occupiedSpaces = new Set(); // Track which board spaces are occupied
let pathfindingGrid = []; // Grid for A* pathfinding
let gridSize = 40; // Size of the pathfinding grid

// Initialize the pathfinding system
function initializePathfinding() {
    // Create a grid for pathfinding
    pathfindingGrid = [];
    for (let i = 0; i < gridSize; i++) {
        pathfindingGrid[i] = [];
        for (let j = 0; j < gridSize; j++) {
            pathfindingGrid[i][j] = {
                walkable: true,
                occupied: false,
                token: null
            };
        }
    }
    
    // Mark board spaces as walkable
    positions.forEach((pos, index) => {
        const gridX = Math.floor((pos.x + 32.4) / 1.62); // Convert to grid coordinates
        const gridZ = Math.floor((pos.z + 32.4) / 1.62);
        if (gridX >= 0 && gridX < gridSize && gridZ >= 0 && gridZ < gridSize) {
            pathfindingGrid[gridX][gridZ].walkable = true;
        }
    });
}

// Update token positions tracking
function updateTokenPosition(token, position) {
    const playerIndex = players.findIndex(p => p.selectedToken === token);
    if (playerIndex !== -1) {
        tokenPositions.set(playerIndex, position);
        updateOccupiedSpaces();
    }
}

// Update which spaces are occupied
function updateOccupiedSpaces() {
    occupiedSpaces.clear();
    tokenPositions.forEach((position, playerIndex) => {
        if (position !== null) {
            occupiedSpaces.add(position);
        }
    });
}

// Check if a space is occupied by another token
function isSpaceOccupied(spaceIndex, excludePlayerIndex = null) {
    let occupied = false;
    tokenPositions.forEach((position, playerIndex) => {
        if (playerIndex !== excludePlayerIndex && position === spaceIndex) {
            occupied = true;
        }
    });
    
    // Debug logging for collision detection
    if (occupied && DEBUG) {
        console.log(`Space ${spaceIndex} is occupied by player ${Array.from(tokenPositions.entries()).find(([idx, pos]) => pos === spaceIndex && idx !== excludePlayerIndex)?.[0]}`);
    }
    
    return occupied;
}

// Get nearby alternative positions when a space is occupied
function getAlternativePositions(spaceIndex, radius = 2) {
    const alternatives = [];
    const centerPos = positions[spaceIndex];
    
    // Check positions in a radius around the occupied space
    for (let i = Math.max(0, spaceIndex - radius); i <= Math.min(positions.length - 1, spaceIndex + radius); i++) {
        if (i !== spaceIndex && !isSpaceOccupied(i)) {
            const pos = positions[i];
            const distance = Math.sqrt(
                Math.pow(pos.x - centerPos.x, 2) + 
                Math.pow(pos.z - centerPos.z, 2)
            );
            if (distance <= radius * 7.2) { // 7.2 is the distance between board spaces
                alternatives.push({
                    index: i,
                    position: pos,
                    distance: distance
                });
            }
        }
    }
    
    // Sort by distance
    alternatives.sort((a, b) => a.distance - b.distance);
    return alternatives;
}

// A* Pathfinding algorithm
function findPath(startIndex, endIndex, avoidSpaces = []) {
    const openSet = [startIndex];
    const closedSet = new Set();
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();
    
    gScore.set(startIndex, 0);
    fScore.set(startIndex, heuristic(startIndex, endIndex));
    
    while (openSet.length > 0) {
        // Find node with lowest fScore
        let current = openSet[0];
        let currentIndex = 0;
        for (let i = 1; i < openSet.length; i++) {
            if (fScore.get(openSet[i]) < fScore.get(current)) {
                current = openSet[i];
                currentIndex = i;
            }
        }
        
        if (current === endIndex) {
            // Reconstruct path
            const path = [];
            while (cameFrom.has(current)) {
                path.unshift(current);
                current = cameFrom.get(current);
            }
            path.unshift(startIndex);
            return path;
        }
        
        openSet.splice(currentIndex, 1);
        closedSet.add(current);
        
        // Get neighbors
        const neighbors = getNeighbors(current);
        for (const neighbor of neighbors) {
            if (closedSet.has(neighbor) || avoidSpaces.includes(neighbor)) {
                continue;
            }
            
            const tentativeGScore = gScore.get(current) + 1;
            
            if (!openSet.includes(neighbor)) {
                openSet.push(neighbor);
            } else if (tentativeGScore >= gScore.get(neighbor)) {
                continue;
            }
            
            cameFrom.set(neighbor, current);
            gScore.set(neighbor, tentativeGScore);
            fScore.set(neighbor, tentativeGScore + heuristic(neighbor, endIndex));
        }
    }
    
    // No path found, return direct path
    return [startIndex, endIndex];
}

// Heuristic function for A* (Manhattan distance)
function heuristic(a, b) {
    const posA = positions[a];
    const posB = positions[b];
    return Math.abs(posA.x - posB.x) + Math.abs(posA.z - posB.z);
}

// Get neighboring spaces
function getNeighbors(spaceIndex) {
    const neighbors = [];
    const totalSpaces = positions.length;
    
    // Add adjacent spaces
    neighbors.push((spaceIndex + 1) % totalSpaces);
    neighbors.push((spaceIndex - 1 + totalSpaces) % totalSpaces);
    
    // Add diagonal spaces for more pathfinding options
    neighbors.push((spaceIndex + 2) % totalSpaces);
    neighbors.push((spaceIndex - 2 + totalSpaces) % totalSpaces);
    
    return neighbors.filter(n => n >= 0 && n < totalSpaces);
}

// Calculate path with collision avoidance
function calculatePathWithCollisionAvoidance(startIndex, endIndex, movingPlayerIndex) {
    const directPath = [];
    let current = startIndex;
    
    while (current !== endIndex) {
        const next = (current + 1) % positions.length;
        directPath.push(next);
        current = next;
    }
    
    // Check for collisions along the path
    const collisionPoints = [];
    directPath.forEach((spaceIndex, pathIndex) => {
        if (isSpaceOccupied(spaceIndex, movingPlayerIndex)) {
            collisionPoints.push({
                spaceIndex: spaceIndex,
                pathIndex: pathIndex
            });
        }
    });
    
    if (collisionPoints.length === 0) {
        // No collisions, use direct path
        if (DEBUG) console.log(`No collisions detected, using direct path from ${startIndex} to ${endIndex}`);
        return [startIndex, ...directPath];
    }
    
    if (DEBUG) console.log(`Collision detected! Player ${movingPlayerIndex} needs to avoid ${collisionPoints.length} occupied spaces`);
    
    // Handle collisions by finding alternative routes
    const finalPath = [];
    let currentSpace = startIndex;
    
    for (const collision of collisionPoints) {
        // Add path up to collision point
        while (currentSpace !== collision.spaceIndex) {
            const next = (currentSpace + 1) % positions.length;
            finalPath.push(next);
            currentSpace = next;
        }
        
        // Find alternative route around collision
        const alternatives = getAlternativePositions(collision.spaceIndex);
        if (alternatives.length > 0) {
            // Use the closest alternative
            const alternative = alternatives[0];
            if (DEBUG) console.log(`Using alternative position ${alternative.index} to avoid collision at ${collision.spaceIndex}`);
            finalPath.push(alternative.index);
            currentSpace = alternative.index;
        }
    }
    
    // Add remaining path to destination
    while (currentSpace !== endIndex) {
        const next = (currentSpace + 1) % positions.length;
        finalPath.push(next);
        currentSpace = next;
    }
    
    if (DEBUG) console.log(`Final path with collision avoidance: [${startIndex}, ${finalPath.join(', ')}]`);
    return [startIndex, ...finalPath];
}

// Enhanced moveToken function with collision avoidance
function moveTokenWithCollisionAvoidance(startPos, endPos, token, callback) {
    const playerIndex = players.findIndex(p => p.selectedToken === token);
    if (playerIndex === -1) {
        console.error("Token not found for any player");
        return;
    }
    
    // Find start and end indices
    const startIndex = positions.findIndex(pos => 
        Math.abs(pos.x - startPos.x) < 0.1 && Math.abs(pos.z - startPos.z) < 0.1
    );
    const endIndex = positions.findIndex(pos => 
        Math.abs(pos.x - endPos.x) < 0.1 && Math.abs(pos.z - endPos.z) < 0.1
    );
    
    if (startIndex === -1 || endIndex === -1) {
        console.error("Could not find position indices");
        return;
    }
    
    // Calculate path with collision avoidance
    const path = calculatePathWithCollisionAvoidance(startIndex, endIndex, playerIndex);
    
    // Move along the calculated path
    moveTokenAlongPath(path, token, callback);
}

// Move token along a calculated path
function moveTokenAlongPath(path, token, callback) {
    if (path.length <= 1) {
        if (callback) callback();
        return;
    }
    
    let currentPathIndex = 0;
    
    function moveToNextPosition() {
        if (currentPathIndex >= path.length - 1) {
            if (callback) callback();
            return;
        }
        
        const currentIndex = path[currentPathIndex];
        const nextIndex = path[currentPathIndex + 1];
        const startPos = positions[currentIndex];
        const endPos = positions[nextIndex];
        
        // Check if the next position is occupied
        if (isSpaceOccupied(nextIndex)) {
            // Find an alternative position
            const alternatives = getAlternativePositions(nextIndex);
            if (alternatives.length > 0) {
                const alternative = alternatives[0];
                const alternativePos = alternative.position;
                
                // Move to alternative position first
                moveToken(startPos, alternativePos, token, () => {
                    currentPathIndex++;
                    moveToNextPosition();
                });
                return;
            }
        }
        
        // Move to next position normally
        moveToken(startPos, endPos, token, () => {
            currentPathIndex++;
            moveToNextPosition();
        });
    }
    
    moveToNextPosition();
}

// Enhanced moveTokenToNewPosition with collision avoidance
function moveTokenToNewPositionWithCollisionAvoidance(spaces, callback) {
    const currentPlayer = players[currentPlayerIndex];

    if (!currentPlayer.selectedToken) {
        console.error(`No token assigned to ${currentPlayer.name}.`);
        console.log('Debug - Current player:', currentPlayer);
        console.log('Debug - Current player index:', currentPlayerIndex);
        console.log('Debug - Global players array:', players);
        console.log('Debug - Window players array:', window.players);
        if (window.players && window.players[currentPlayerIndex]) {
            console.log('Debug - Window players[currentPlayerIndex].selectedToken:', window.players[currentPlayerIndex].selectedToken);
        }
        
        // Try to get token from window.players array as fallback
        if (window.players && window.players[currentPlayerIndex] && window.players[currentPlayerIndex].selectedToken) {
            console.log('Attempting to use token from window.players array as fallback');
            currentPlayer.selectedToken = window.players[currentPlayerIndex].selectedToken;
        } else {
            console.error('No token available in either players array');
            return;
        }
    }

    const oldPosition = currentPlayer.currentPosition;
    const propertiesCount = positions.length;
    const newPosition = (oldPosition + spaces) % propertiesCount;

    const token = currentPlayer.selectedToken;
    const tokenName = token.userData.tokenName;

    // Update token position tracking
    updateTokenPosition(token, oldPosition);

    // --- Make token and all children visible on first move ---
    if (!token.visible) {
        token.visible = true;
        token.traverse(child => { child.visible = true; });
    }

    let isWoman = tokenName === "woman";
    if (isWoman) playWalkAnimation(token);

    // --- FOOTBALL: throw directly to destination ---
    if (tokenName === "football") {
        const startPos = positions[oldPosition];
        const endPos = positions[newPosition];
        const finalHeight = getTokenHeight(tokenName, endPos.y) + 1.0;
        throwFootballAnimation(token, endPos, finalHeight, () => {
            updateTokenPosition(token, newPosition);
            finishMove(currentPlayer, newPosition, oldPosition + spaces >= propertiesCount);
            if (callback) callback();
        });
        return;
    }

    // --- ROLLS ROYCE: drive with collision avoidance ---
    if (tokenName === "rolls royce") {
        const path = calculatePathWithCollisionAvoidance(oldPosition, newPosition, currentPlayerIndex);
        const pathPositions = path.map(index => positions[index]);
        driveRollsRoyceAlongPath(token, pathPositions, () => {
            updateTokenPosition(token, newPosition);
            finishMove(currentPlayer, newPosition, oldPosition + spaces >= propertiesCount);
            if (callback) callback();
        });
        return;
    }

    // --- HELICOPTER: fly with collision avoidance ---
    if (tokenName === "helicopter") {
        const path = calculatePathWithCollisionAvoidance(oldPosition, newPosition, currentPlayerIndex);
        const pathPositions = path.map(index => positions[index]);
        flyWithHelicopterEffectPath(pathPositions, token, () => {
            updateTokenPosition(token, newPosition);
            finishMove(currentPlayer, newPosition, oldPosition + spaces >= propertiesCount);
            if (callback) callback();
        });
        return;
    }

    // --- All other tokens: move with collision avoidance ---
    const path = calculatePathWithCollisionAvoidance(oldPosition, newPosition, currentPlayerIndex);
    moveTokenAlongPath(path, token, () => {
        updateTokenPosition(token, newPosition);
        finishMove(currentPlayer, newPosition, oldPosition + spaces >= propertiesCount);
        if (isWoman) stopWalkAnimation(token);
        if (callback) callback();
    });
}

function showDiceResult(total, roll1, roll2) {
    const resultDisplay = document.createElement('div');
    resultDisplay.className = 'dice-result';
    const article = [8, 11, 18].includes(total) ? 'an' : 'a';
    resultDisplay.textContent = `${isCurrentPlayerAI() ? 'AI ' : ''}Rolled ${article} ${total}!`;
    document.body.appendChild(resultDisplay);

    setTimeout(() => {
        resultDisplay.classList.add('show');
        setTimeout(() => {
            resultDisplay.remove();
        }, 2000);
    }, 100);
}

// Modify your initPlayerTokenSelection function to create the dice button
const originalInitPlayerTokenSelection = initPlayerTokenSelection;
initPlayerTokenSelection = function() {
    originalInitPlayerTokenSelection();
    createDiceButton();
};

function showFeedback(message, duration = 2000) {
    const feedbackElement = document.createElement('div');
    feedbackElement.className = 'feedback-message';
    feedbackElement.textContent = message;
    document.body.appendChild(feedbackElement);

    // Animate feedback appearance
    requestAnimationFrame(() => {
        feedbackElement.style.opacity = '1';
        feedbackElement.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
        feedbackElement.classList.add('fade-out');
        setTimeout(() => {
            if (feedbackElement.parentElement) {
                feedbackElement.parentElement.removeChild(feedbackElement);
            }
        }, 300);
    }, duration);
}

let gameStartTime = null; // Track the start time of the game
const WINNING_AMOUNT = 10000; // Amount to win the game

function applyRandomEvent(player) {
    const randomEvent = Math.random();
    if (randomEvent < 0.1) {
        player.money += 2000; // Increased from $1,000 to $2,000
        showFeedback(`${player.name} won a $2,000 jackpot!`);
    } else if (randomEvent < 0.2) {
        player.money -= 1000; // Increased penalty from $500 to $1,000
        showFeedback(`${player.name} lost $1,000 in a bad investment.`);
    }
}

function startGameTimer() {
    gameStartTime = Date.now();

    // Periodically check for win conditions
    const interval = setInterval(() => {
        const elapsedTime = Date.now() - gameStartTime;

        // Check if any player has reached $10,000
        const millionaire = players.find(player => player.money >= WINNING_AMOUNT);
        if (millionaire) {
            clearInterval(interval);
            declareWinner(millionaire, "reached $10,000!");
            return;
        }
    }, 1000); // Check every second
}

function declareWinner(winner, reason) {
    alert(`Game Over! ${winner.name} wins because they ${reason}`);
    resetGame();
}

properties.forEach(property => {
    if (property.housePrice) {
        property.housePrice *= 2; // Double the cost of houses
    }
    if (property.hotelPrice) {
        property.hotelPrice *= 2; // Double the cost of hotels
    }
});

function unmortgageProperty(player, property) {
    const unmortgageCost = property.mortgageValue * 1.1; // 10% interest
    if (player.money >= unmortgageCost && property.mortgaged) {
        player.money -= unmortgageCost;
        property.mortgaged = false;
        showNotification(`${property.name} has been unmortgaged for $${unmortgageCost}`);
        updateMoneyDisplay();
        updatePropertyManagementBoard(player);
    } else {
        showNotification("Not enough money to unmortgage this property!");
    }
}

function showNotification(message) {
    const notification = document.createElement("div");
    notification.className = "notification";
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add("show");
    }, 100);

    setTimeout(() => {
        notification.classList.remove("show");
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

function showTurnIndicator(show) {
    const indicator = document.getElementById('turn-indicator');
    if (indicator) {
        indicator.style.display = show ? 'block' : 'none';
    }
}

function updateOtherPlayersBoard(currentPlayer) {
    const otherPlayersList = document.getElementById("other-players-list");
    if (!otherPlayersList) {
        console.warn("other-players-list element not found");
        return;
    }
    otherPlayersList.innerHTML = "";

    players.forEach(player => {
        if (player !== currentPlayer) {
            player.properties.forEach(property => {
                const propertyItem = document.createElement("div");
                propertyItem.className = "other-property-item";

                const propertyName = document.createElement("h3");
                propertyName.textContent = property.name;
                propertyItem.appendChild(propertyName);

                const ownerInfo = document.createElement("p");
                ownerInfo.textContent = `Owned by: ${player.name}`;
                propertyItem.appendChild(ownerInfo);

                // Mortgage status INSIDE action group
                const actions = document.createElement("div");
                actions.className = "action-group";
                const mortgageInfo = document.createElement("button");
                mortgageInfo.textContent = property.mortgaged ? "Mortgaged" : "Not Mortgaged";
                mortgageInfo.className = "status-btn";
                mortgageInfo.disabled = true;
                actions.appendChild(mortgageInfo);

                propertyItem.appendChild(actions);

                otherPlayersList.appendChild(propertyItem);
            });
        }
    });
}

function eliminatePlayer(player) {
    showFeedback(`${player.name} has been eliminated from the game!`);

    // Transfer properties to the bank or auction them
    player.properties.forEach(property => {
        property.owner = null; // Reset ownership
        property.mortgaged = false; // Unmortgage properties
    });

    // Remove player from the game
    players = players.filter(p => p !== player);

    // Check if only one player remains
    if (players.length === 1) {
        declareWinner(players[0], "eliminated all other players!");
    }
}

function upgradeProperty(player, property) {
    if (!property.owner || property.owner !== player) {
        showFeedback("You don't own this property!");
        return;
    }

    if (property.houses < 4) {
        if (player.money >= property.housePrice) {
            player.money -= property.housePrice;
            property.houses += 1;
            showFeedback(`Built a house on ${property.name}. Rent increased!`);
        } else {
            showFeedback("Not enough money to build a house!");
        }
    } else if (!property.hotel) {
        if (player.money >= property.hotelPrice) {
            player.money -= property.hotelPrice;
            property.hotel = true;
            property.houses = 0; // Replace houses with a hotel
            showFeedback(`Built a hotel on ${property.name}. Rent maximized!`);
        } else {
            showFeedback("Not enough money to build a hotel!");
        }
    } else {
        showFeedback("This property already has a hotel!");
    }

    updateMoneyDisplay();
    updatePropertyManagementBoard(player);
}

function handleIncomeTax(player) {
    // Calculate 10% of the player's total worth (money + property prices + houses/hotels)
    let totalWorth = player.money;
    player.properties.forEach(property => {
        totalWorth += property.price || 0;
        totalWorth += (property.houses || 0) * (property.housePrice || 0);
        totalWorth += (property.hotel ? property.hotelPrice : 0);
    });
    const tenPercentTax = Math.floor(totalWorth * 0.1);

    if (isCurrentPlayerAI()) {
        // AI logic for Income Tax
        console.log(`${player.name} (AI) landed on Income Tax.`);

        // AI decision-making: Choose the cheaper option
        if (player.money >= 200 && (200 <= tenPercentTax || player.money < tenPercentTax)) {
            player.money -= 200;
            console.log(`${player.name} (AI) chose to pay $200 in Income Tax.`);
            showFeedback(`${player.name} (AI) paid $200 in Income Tax.`);
        } else if (player.money >= tenPercentTax) {
            player.money -= tenPercentTax;
            console.log(`${player.name} (AI) chose to pay $${tenPercentTax} (10% of total worth) in Income Tax.`);
            showFeedback(`${player.name} (AI) paid $${tenPercentTax} in Income Tax.`);
        } else {
            console.log(`${player.name} (AI) doesn't have enough money to pay Income Tax!`);
            showFeedback(`${player.name} (AI) couldn't afford Income Tax.`);
            handleBankruptcy(player, null); // Handle bankruptcy if AI can't pay
        }

        updateMoneyDisplay();
        setTimeout(() => endTurn(), 1000); // End AI's turn after paying
    } else {
        // Human player UI
        const overlay = document.createElement('div');
        overlay.className = 'income-tax-overlay';

        const popup = document.createElement('div');
        popup.className = 'income-tax-popup';

        const header = document.createElement('div');
        header.className = 'popup-header';
        header.textContent = 'Income Tax';

        const message = document.createElement('div');
        message.className = 'income-tax-message';
        message.textContent = `${player.name}, you must pay $200 or 10% of your total worth.`;

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'button-container';

        // Button to pay $200
        const pay200Button = document.createElement('button');
        pay200Button.className = 'action-button pay';
        pay200Button.textContent = 'Pay $200';
        pay200Button.onclick = () => {
            if (player.money >= 200) {
                player.money -= 200;
                showFeedback(`${player.name} paid $200 in Income Tax.`);
                updateMoneyDisplay();
            } else {
                showFeedback("Not enough money to pay $200!");
            }
            closePopup(overlay);
            endTurn(); // End the turn after the player makes a decision
        };

        // Button to pay 10% of total worth
        const pay10PercentButton = document.createElement('button');
        pay10PercentButton.className = 'action-button pay';
        pay10PercentButton.textContent = `Pay 10% ($${tenPercentTax})`;
        pay10PercentButton.onclick = () => {
            if (player.money >= tenPercentTax) {
                player.money -= tenPercentTax;
                showFeedback(`${player.name} paid $${tenPercentTax} in Income Tax.`);
                updateMoneyDisplay();
            } else {
                showFeedback("Not enough money to pay 10%!");
            }
            closePopup(overlay);
            endTurn(); // End the turn after the player makes a decision
        };

        // Add buttons to the container
        buttonContainer.appendChild(pay200Button);
        buttonContainer.appendChild(pay10PercentButton);

        // Add header, message, and buttons to the popup
        popup.appendChild(header);
        popup.appendChild(message);
        popup.appendChild(buttonContainer);

        // Add the popup to the overlay
        overlay.appendChild(popup);
        document.body.appendChild(overlay);

        // Add fade-in animation
        requestAnimationFrame(() => {
            popup.classList.add('fade-in');
        });
    }
}

function closePopup(overlay) {
    if (!overlay) {
        console.error("closePopup called with an invalid overlay.");
        return;
    }
    overlay.classList.add('fade-out');
    setTimeout(() => {
        if (overlay.parentElement) {
            overlay.parentElement.removeChild(overlay);
        }
    }, 300);
}

function showFreeParkingUI(player) {
    // Check if current player is AI first
    if (isCurrentPlayerAI()) {
        console.log("AI landed on Free Parking. Taking a break.");
        showFeedback("AI landed on Free Parking");
        setTimeout(() => endTurn(), 1500);
        return;
    }

    // Get the Free Parking property object
    const freeParkingProperty = properties.find(p => p.name === "FREE PARKING");

    // Create the overlay
    const overlay = document.createElement('div');
    overlay.className = 'free-parking-overlay';

    // Create the popup
    const popup = document.createElement('div');
    popup.className = 'free-parking-popup';

    // Create a container for the image and content
    const contentContainer = document.createElement('div');
    contentContainer.className = 'free-parking-content-container';
    contentContainer.style.display = 'flex';
    contentContainer.style.gap = '20px';

    // Add image container on the left
    const imageContainer = document.createElement('div');
    imageContainer.className = 'free-parking-image-container';
    imageContainer.style.width = '40vw';
    imageContainer.style.maxWidth = '500px';
    imageContainer.style.height = '28vw';
    imageContainer.style.maxHeight = '350px';
    imageContainer.style.minWidth = '220px';
    imageContainer.style.minHeight = '150px';
    imageContainer.style.overflow = 'hidden';
    imageContainer.style.borderRadius = '8px';
    imageContainer.style.display = 'flex';
    imageContainer.style.alignItems = 'center';
    imageContainer.style.justifyContent = 'center';

    // Show the image from the properties array
    let imageUrl = "";
    if (freeParkingProperty && freeParkingProperty.imageUrls) {
        if (Array.isArray(freeParkingProperty.imageUrls)) {
            imageUrl = freeParkingProperty.imageUrls[0];
        } else {
            imageUrl = freeParkingProperty.imageUrls;
        }
    }
    const img = document.createElement('img');
    img.src = imageUrl;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    img.style.objectPosition = 'top';
    img.style.borderRadius = '8px';
    // Move Water Works image down to show more of the top
    imageContainer.appendChild(img);

    // Responsive adjustment for small screens
    const style = document.createElement('style');
    style.textContent = `
        @media (max-width: 700px) {
            .free-parking-image-container {
                width: 90vw !important;
                height: 40vw !important;
                max-width: 98vw !important;
                max-height: 50vw !important;
            }
        }
    `;
    document.head.appendChild(style);

    // Add content container on the right
    const content = document.createElement('div');
    content.className = 'free-parking-content';
    content.style.flex = '1';

    // Add header
    const header = document.createElement('div');
    header.className = 'popup-header';
    header.textContent = 'Free Parking';
    header.style.backgroundColor = '#4CAF50';
    header.style.color = 'white';
    header.style.padding = '15px';
    header.style.borderRadius = '8px 8px 0 0';

    // Add message
    const message = document.createElement('div');
    message.className = 'free-parking-message';
    message.textContent = `${player.name}, enjoy your break! Take a moment to rest and plan your next moves.`;
    message.style.padding = '20px';
    message.style.fontSize = '18px';
    message.style.lineHeight = '1.5';

    // Add button container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'button-container';
    buttonContainer.style.padding = '20px';
    buttonContainer.style.textAlign = 'center';

    // Close button
    const closeButton = document.createElement('button');
    closeButton.className = 'action-button close';
    closeButton.textContent = 'Continue Game';
    closeButton.style.padding = '12px 24px';
    closeButton.style.fontSize = '16px';
    closeButton.onclick = () => {
        closePopup(overlay);
        endTurn();
    };
    buttonContainer.appendChild(closeButton);

    // Assemble the content
    content.appendChild(header);
    content.appendChild(message);
    content.appendChild(buttonContainer);

    // Add image and content to the container
    contentContainer.appendChild(imageContainer);
    contentContainer.appendChild(content);

    // Add the content container to the popup
    popup.appendChild(contentContainer);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Add fade-in animation
    requestAnimationFrame(() => {
        popup.classList.add('fade-in');
    });

    // Auto-close after 10 seconds
    setTimeout(() => {
        if (overlay.parentElement) {
            closePopup(overlay);
            endTurn();
        }
    }, 10000);
}

function handleLuxuryTax(player) {
    const luxuryTaxAmount = 100; // Fixed luxury tax amount

    if (isCurrentPlayerAI()) {
        // AI logic for Luxury Tax
        console.log(`${player.name} (AI) landed on Luxury Tax.`);

        if (player.money >= luxuryTaxAmount) {
            player.money -= luxuryTaxAmount;
            console.log(`${player.name} (AI) paid $${luxuryTaxAmount} in Luxury Tax.`);
            showFeedback(`${player.name} (AI) paid $${luxuryTaxAmount} in Luxury Tax.`);
        } else {
            console.log(`${player.name} (AI) doesn't have enough money to pay Luxury Tax!`);
            showFeedback(`${player.name} (AI) couldn't afford Luxury Tax.`);
            handleBankruptcy(player, null); // Handle bankruptcy if AI can't pay
        }

        updateMoneyDisplay();
        setTimeout(() => endTurn(), 1000); // End AI's turn after paying
    } else {
        // Human player UI
        const overlay = document.createElement('div');
        overlay.className = 'luxury-tax-overlay';

        const popup = document.createElement('div');
        popup.className = 'luxury-tax-popup';

        const header = document.createElement('div');
        header.className = 'popup-header';
        header.textContent = 'Luxury Tax';

        const message = document.createElement('div');
        message.className = 'luxury-tax-message';
        message.textContent = `${player.name}, you must pay $${luxuryTaxAmount}.`;

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'button-container';

        // Button to pay Luxury Tax
        const payButton = document.createElement('button');
        payButton.className = 'action-button pay';
        payButton.textContent = `Pay $${luxuryTaxAmount}`;
        payButton.onclick = () => {
            if (player.money >= luxuryTaxAmount) {
                player.money -= luxuryTaxAmount;
                showFeedback(`${player.name} paid $${luxuryTaxAmount} in Luxury Tax.`);
                updateMoneyDisplay();
            } else {
                showFeedback("Not enough money to pay Luxury Tax!");
            }
            closePopup(overlay);
            endTurn(); // End the turn after the player makes a decision
        };

        // Add close button
        const closeButton = document.createElement('button');
        closeButton.className = 'action-button close';
        closeButton.textContent = 'Close';
        closeButton.onclick = () => {
            closePopup(overlay);
        };

        // Add buttons to the container
        buttonContainer.appendChild(payButton);
        buttonContainer.appendChild(closeButton);

        // Add header, message, and buttons to the popup
        popup.appendChild(header);
        popup.appendChild(message);
        popup.appendChild(buttonContainer);

        // Add the popup to the overlay
        overlay.appendChild(popup);
        document.body.appendChild(overlay);

        // Add fade-in animation
        requestAnimationFrame(() => {
            popup.classList.add('fade-in');
        });
    }
}

function validateTurnProgression() {
    const currentPlayer = players[currentPlayerIndex];
    let isValid = true;
    let errorMessages = [];

    try {
        // 1. Basic player validation
        if (!currentPlayer) {
            errorMessages.push("Invalid current player");
            isValid = false;
        }

        // 2. Turn state validation
        if (isTurnInProgress) {
            errorMessages.push("Turn is already in progress");
            isValid = false;
        }

        // 3. Action validation for non-jailed players
        if (!currentPlayer.inJail) {
            if (!hasRolledDice && !isCurrentPlayerAI()) {
                errorMessages.push("Dice have not been rolled yet");
                isValid = false;
            }

            if (hasRolledDice && !hasMovedToken) {
                errorMessages.push("Token movement not completed");
                isValid = false;
            }
        }

        // 4. AI-specific validation
        if (isCurrentPlayerAI() && isAIProcessing) {
            errorMessages.push("AI is still processing its turn");
            isValid = false;
        }

        // 5. Property handling validation
        if (hasMovedToken && !hasHandledProperty && !currentPlayer.inJail) {
            errorMessages.push("Property has not been handled yet");
            isValid = false;
        }

        // 6. Special space validation
        const currentSpace = placeNames[currentPlayer.currentPosition];
        if (currentSpace === "Chance" || currentSpace === "Community Cards") {
            if (!hasDrawnCard && hasMovedToken) {
                errorMessages.push("Card has not been drawn yet");
                isValid = false;
            }
        }

        // 7. Turn order validation
        if (lastPlayerIndex !== -1) {
            const expectedPlayerIndex = (lastPlayerIndex + 1) % players.length;
            if (currentPlayerIndex !== expectedPlayerIndex && !currentPlayer.inJail) {
                errorMessages.push(`Invalid turn order. Expected Player ${expectedPlayerIndex + 1}`);
                isValid = false;
            }
        }

        // Log validation results
        if (!isValid) {
            console.warn("Turn validation failed:", errorMessages);
            showFeedback("Please complete all required actions before ending turn");
        }

        // Return validation state and messages
        return {
            isValid,
            errors: errorMessages,
            currentState: {
                playerIndex: currentPlayerIndex,
                playerName: currentPlayer?.name,
                position: currentPlayer?.currentPosition,
                hasRolled: hasRolledDice,
                hasMoved: hasMovedToken,
                hasHandledProperty: hasHandledProperty,
                isInJail: currentPlayer?.inJail,
                isAI: isCurrentPlayerAI(),
                turnCounter: turnCounter
            }
        };

    } catch (error) {
        console.error("Error in validateTurnProgression:", error);
        return {
            isValid: false,
            errors: ["Critical validation error occurred"],
            currentState: null
        };
    }
}

function updatePropertyManagementBoard(player) {
    const propertyList = document.getElementById("property-list");
    if (!propertyList) {
        console.warn("Property list element not found, skipping update");
        return;
    }
    propertyList.innerHTML = ""; // Clear the list

    player.properties.forEach(property => {
        const propertyItem = document.createElement("div");
        propertyItem.className = "property-item";

        const propertyName = document.createElement("h3");
        propertyName.textContent = property.name;
        propertyItem.appendChild(propertyName);

        // START: Group action buttons
        const actions = document.createElement("div");
        actions.className = "action-group";

        // Mortgage/unmortgage button
        const actionButton = document.createElement("button");
        if (property.mortgaged) {
            actionButton.textContent = "Unmortgage";
            actionButton.className = "unmortgage";
            actionButton.disabled = player !== players[currentPlayerIndex];
            actionButton.onclick = () => unmortgageProperty(player, property);
        } else {
            actionButton.textContent = "Mortgage";
            actionButton.className = "mortgage";
            actionButton.disabled = player !== players[currentPlayerIndex];
            actionButton.onclick = () => mortgageProperty(player, property);
        }
        actions.appendChild(actionButton);

        // If you want to add more actions, add more buttons here...

        propertyItem.appendChild(actions);
        // END: Group action buttons

        propertyList.appendChild(propertyItem);
    });
}

// Helper function to check if all required actions are completed
function areAllRequiredActionsCompleted() {
    const validation = validateTurnProgression();
    return validation.isValid;
}

// Use this in endTurn and other critical points
function canProcessTurn() {
    const validation = validateTurnProgression();
    if (!validation.isValid) {
        console.log("Turn cannot proceed:", validation.errors);
        return false;
    }
    return true;
}

// Add this to your error handling
function handleTurnError(error) {
    console.error("Turn error occurred:", error);
    const validation = validateTurnProgression();
    console.log("Current turn state:", validation.currentState);

    // Reset critical flags if needed
    isTurnInProgress = false;
    isAIProcessing = false;

    // Show feedback to user
    showFeedback("An error occurred. Please try again.");
}

function showSuggestionNotification() {
    // Prevent multiple notifications stacking
    if (document.getElementById("suggestion-notification")) return;

    const notif = document.createElement("div");
    notif.id = "suggestion-notification";
    notif.textContent = "Email: Maurice13stu@gmail.com for suggestions";
    notif.style.position = "fixed";
    notif.style.bottom = "30px";
    notif.style.right = "30px";
    notif.style.background = "rgba(40,40,40,0.95)";
    notif.style.color = "#fff";
    notif.style.padding = "16px 28px";
    notif.style.borderRadius = "8px";
    notif.style.boxShadow = "0 4px 16px rgba(0,0,0,0.25)";
    notif.style.fontSize = "16px";
    notif.style.zIndex = "9999";
    notif.style.opacity = "0";
    notif.style.transition = "opacity 0.4s";

    document.body.appendChild(notif);
    setTimeout(() => notif.style.opacity = "1", 50);

    setTimeout(() => {
        notif.style.opacity = "0";
        setTimeout(() => notif.remove(), 400);
    }, 5000); // Show for 5 seconds
}

function setupPropertiesToggleButton() {
    // Only add if not already present (prevents duplicates)
    if (document.getElementById('properties-toggle-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'properties-toggle-btn';
    btn.innerText = 'My Properties'; // Remove emoji, make text short

    // Make button smaller for mobile (handled by CSS, but also set here for initial render)
    btn.style.fontSize = '14px';
    btn.style.padding = '10px 14px';
    btn.style.borderRadius = '8px';
    btn.style.minWidth = '90px';
    btn.style.maxWidth = '130px';
    btn.style.width = 'auto';

    document.body.appendChild(btn);

    btn.addEventListener('click', function() {
        const myBoard = document.getElementById('property-management-board');
        const otherBoard = document.getElementById('other-players-board');

        const visible = myBoard.classList.contains('board-visible');
        if (visible) {
            myBoard.classList.remove('board-visible');
            otherBoard.classList.remove('board-visible');
            btn.innerText = 'My Properties';
        } else {
            myBoard.classList.add('board-visible');
            otherBoard.classList.add('board-visible');
            btn.innerText = 'Hide Properties';
        }
    });
}

// Show every 4 minutes (240000 ms)
setInterval(showSuggestionNotification, 240000);

// Optionally, show once shortly after page load
setTimeout(showSuggestionNotification, 10000);

/*
// Function to create a UI for testing mode
function createTestingModeUI() {
    const testingModeContainer = document.createElement('div');
    testingModeContainer.id = 'testing-mode-container';
    testingModeContainer.style.position = 'fixed';
    testingModeContainer.style.top = '20px';
    testingModeContainer.style.right = '20px';
    testingModeContainer.style.width = '300px';
    testingModeContainer.style.padding = '10px';
    testingModeContainer.style.backgroundColor = '#333';
    testingModeContainer.style.color = '#fff';
    testingModeContainer.style.borderRadius = '8px';
    testingModeContainer.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
    testingModeContainer.style.zIndex = '1000';

    const title = document.createElement('h3');
    title.textContent = 'Testing Mode';
    title.style.marginBottom = '10px';
    testingModeContainer.appendChild(title);

    const propertySelect = document.createElement('select');
    propertySelect.style.width = '100%';
    propertySelect.style.padding = '5px';
    propertySelect.style.marginBottom = '10px';
    propertySelect.style.borderRadius = '4px';
    propertySelect.style.border = '1px solid #ccc';

    // Populate the dropdown with place names
    placeNames.forEach((placeName, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = placeName;
        propertySelect.appendChild(option);
    });

    testingModeContainer.appendChild(propertySelect);

    const testButton = document.createElement('button');
    testButton.textContent = 'Show Property UI';
    testButton.style.width = '100%';
    testButton.style.padding = '10px';
    testButton.style.border = 'none';
    testButton.style.borderRadius = '4px';
    testButton.style.backgroundColor = '#4CAF50';
    testButton.style.color = '#fff';
    testButton.style.cursor = 'pointer';

    testButton.onclick = () => {
        const selectedIndex = parseInt(propertySelect.value, 10);
        if (!isNaN(selectedIndex) && placeNames[selectedIndex]) {
            showPropertyUI(selectedIndex);
        } else {
            alert('Invalid property selected!');
        }
    };

    testingModeContainer.appendChild(testButton);
    document.body.appendChild(testingModeContainer);
}

// Call this function to initialize the testing mode UI
createTestingModeUI();
*/

init();
setupPropertiesToggleButton();

// --- Helicopter Hover Animation State ---
function startHelicopterHover(animatedModel, position) {
    if (!animatedModel) return;
    stopHelicopterHover();
    animatedModel.visible = true;
    // Play all actions (rotors)
    if (animatedModel.userData.actions) {
        animatedModel.userData.actions.forEach(action => action.play());
    }
    // Start helicopter sound only if this is actually a helicopter token
    if (animatedModel.userData.tokenName === "helicopter") {
        helicopterSound.currentTime = 0;
        helicopterSound.play().catch(() => {});
    }
    let t = 0;
    const hoverRadius = 1.1 + Math.random() * 0.5; // Small circle
    const hoverSpeed = 0.7 + Math.random() * 0.3; // Slightly random speed
    const hoverHeight = 3.5;
    const baseY = hoverHeight;
    const baseX = position.x;
    const baseZ = position.z;

    function animate() {
        t += 1 / 60;
        // Circle or figure-eight path
        const angle = t * hoverSpeed;
        const x = baseX + Math.cos(angle) * hoverRadius * 0.7;
        const z = baseZ + Math.sin(angle * 1.2) * hoverRadius * 0.5;
        const y = baseY + Math.sin(angle * 2.1) * 0.35 + Math.cos(angle * 1.3) * 0.18;
        animatedModel.position.set(x, y, z);

        // Gentle yaw oscillation
        const yaw = Math.sin(angle * 1.1) * 0.18;
        animatedModel.rotation.set(
            Math.sin(angle * 0.7) * 0.08, // Subtle banking
            Math.PI + Math.PI / 2 + yaw,
            0
        );
        if (animatedModel.userData.mixer) animatedModel.userData.mixer.update(1 / 60);
        helicopterHoverAnim = requestAnimationFrame(animate);
    }
    helicopterHoverAnim = requestAnimationFrame(animate);
}

function stopHelicopterHover() {
    if (helicopterHoverAnim) {
        cancelAnimationFrame(helicopterHoverAnim);
        helicopterHoverAnim = null;
    }
    // Stop helicopter sound only if it's currently playing
    if (helicopterSound && !helicopterSound.paused) {
        helicopterSound.pause();
        helicopterSound.currentTime = 0;
    }
}

function flyWithHelicopterEffectPath(path, token, callback) {
    // Set movement flags for camera following
    currentlyMovingToken = token;
    isTokenMoving = true;
    
    stopHelicopterHover(); // Stop idle before moving
    // Start helicopter sound for movement only if this is a helicopter token
    if (token.userData.tokenName === "helicopter") {
        helicopterSound.currentTime = 0;
        helicopterSound.play().catch(() => {});
    }
    // Always use animated model for helicopter if available
    const animatedModel = token.userData.animatedModel || token;
    let mixer, actions;
    if (animatedModel.userData.mixer) mixer = animatedModel.userData.mixer;
    if (animatedModel.userData.actions) actions = animatedModel.userData.actions;

    // --- Dynamic arc height based on path length ---
    const minFlightHeight = 7;
    const maxFlightHeight = 16;
    const flightHeight = Math.min(maxFlightHeight, minFlightHeight + path.length * 1.5);
    const takeoffHeight = 2.5;
    const hoverHeight = 3.5;
    const points = path.map((p, i) => {
        if (i === 0) return new THREE.Vector3(p.x, takeoffHeight, p.z);
        if (i === path.length - 1) return new THREE.Vector3(p.x, hoverHeight, p.z);
        return new THREE.Vector3(p.x, flightHeight, p.z);
    });
    const curve = new CatmullRomCurve3(points);
    const duration = 4200 + path.length * 600;
    const startTime = Date.now();
    const modelOffsetAngle = Math.PI + Math.PI / 2;
    let lastDirection = null;
    let flareTimer = 0;
    const flareDuration = 0.18;

    function animate() {
        const elapsed = Date.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        let pos = curve.getPoint(t);
        const nextPos = curve.getPoint(Math.min(t + 0.01, 1));
        const prevPos = curve.getPoint(Math.max(t - 0.01, 0));
        const direction = new THREE.Vector3().subVectors(nextPos, pos).normalize();
        const angle = Math.atan2(direction.x, direction.z);
        const bobbingY = Math.sin(t * Math.PI * 4) * 0.45;
        const yawOscillation = Math.sin(t * Math.PI * 2) * 0.13;
        const curveDelta = new THREE.Vector3().subVectors(nextPos, prevPos).normalize();
        const turnAmount = curveDelta.x * direction.z - curveDelta.z * direction.x;
        let bank = THREE.MathUtils.clamp(turnAmount * 2.2, -0.65, 0.65);
        if (lastDirection && direction.angleTo(lastDirection) > 0.18) {
            flareTimer = flareDuration;
        }
        if (flareTimer > 0) {
            bank += Math.sin((flareDuration - flareTimer) * Math.PI / flareDuration) * 0.35;
            flareTimer -= 1 / 60;
        }
        lastDirection = direction.clone();
        let y = pos.y + bobbingY;
        // Never go below hoverHeight
        y = Math.max(y, hoverHeight);
        if (animatedModel) {
            animatedModel.position.set(pos.x, y, pos.z);
            animatedModel.rotation.set(
                bank,
                angle + modelOffsetAngle + yawOscillation,
                0
            );
            if (mixer) mixer.update(1 / 60);
        } else {
            token.position.set(pos.x, y, pos.z);
            token.rotation.set(
                bank,
                angle + modelOffsetAngle + yawOscillation,
                0
            );
        }
        if (t < 1) {
            requestAnimationFrame(animate);
        } else {
            // Stay hovering at the new position
            if (animatedModel) {
                animatedModel.position.set(pos.x, hoverHeight, pos.z);
                animatedModel.rotation.set(0, angle + modelOffsetAngle, 0);
                if (actions) actions.forEach(action => action.play());
                animatedModel.visible = true;
                // Start idle hover at new position
                startHelicopterHover(animatedModel, {
                    x: pos.x,
                    z: pos.z
                });
            } else {
                token.position.set(pos.x, hoverHeight, pos.z);
                token.rotation.set(0, angle + modelOffsetAngle, 0);
            }
            // Clear movement flags for camera following
            isTokenMoving = false;
            currentlyMovingToken = null;
            if (callback) callback();
        }
    }
    animate();
}

function moveHelicopterToNewPosition(spaces) {
    const currentPlayer = players[currentPlayerIndex];
    if (!currentPlayer.selectedToken || currentPlayer.selectedToken.userData.tokenName !== "helicopter") {
        console.error("No helicopter token assigned to the current player.");
        return;
    }
    const oldPosition = currentPlayer.currentPosition;
    const propertiesCount = positions.length;
    const newPosition = (oldPosition + spaces) % propertiesCount;
    const token = currentPlayer.selectedToken;
    // Collect the path of positions (including start and end)
    let path = [];
    let current = oldPosition;
    while (current !== newPosition) {
        path.push(positions[current]);
        current = (current + 1) % propertiesCount;
    }
    path.push(positions[newPosition]);
    // Always use animated model for helicopter
    const animatedModel = token.userData.animatedModel;
    if (animatedModel) {
        stopHelicopterHover();
        animatedModel.visible = true;
        if (animatedModel.userData.actions) animatedModel.userData.actions.forEach(action => action.play());
        flyWithHelicopterEffectPath(path, token, () => {
            finishMove(currentPlayer, newPosition, oldPosition + spaces >= propertiesCount);
        });
    } else {
        flyWithHelicopterEffectPath(path, token, () => {
            finishMove(currentPlayer, newPosition, oldPosition + spaces >= propertiesCount);
        });
    }
}

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    scene.traverse((object) => {
        if (object.userData.idleMixer) object.userData.idleMixer.update(delta);
        if (object.userData.walkMixer) object.userData.walkMixer.update(delta);
        if (object.userData.mixer) object.userData.mixer.update(delta);
    });

    // --- Update audio volume for helicopter and Rolls Royce ---
    let heliToken = null;
    let rrToken = null;
    scene.traverse((obj) => {
        if (obj.userData && obj.userData.tokenName === 'helicopter') heliToken = obj;
        if (obj.userData && obj.userData.tokenName === 'rolls royce') rrToken = obj;
    });
    updateTokenAudioVolume(heliToken, helicopterSound);
    updateTokenAudioVolume(rrToken, accelerationSound);

    // --- Automatic Camera Behavior ---
    // Follow token when moving, return to overhead view when not moving
    if (isTokenMoving && currentlyMovingToken) {
        // Follow the moving token
        if (DEBUG) {
            console.log('[CameraFollow] Following moving token:', currentlyMovingToken.userData.tokenName);
        }
        controls.target.copy(currentlyMovingToken.position);
        if (!userIsMovingCamera) {
            const desiredPos = new THREE.Vector3(
                currentlyMovingToken.position.x + 4,
                currentlyMovingToken.position.y + 7,
                currentlyMovingToken.position.z + 4
            );
            camera.position.lerp(desiredPos, 0.18);
        }
        controls.update();
    } else {
        // Return to default overhead view when no token is moving
        if (!userIsMovingCamera) {
            const defaultPosition = new THREE.Vector3(0, 40, 0);
            const defaultTarget = new THREE.Vector3(0, 0, 0);
            
            // Use a slower, smoother transition to avoid glitches
            const transitionSpeed = 0.02;
            
            // Smoothly transition back to overhead view
            camera.position.lerp(defaultPosition, transitionSpeed);
            controls.target.lerp(defaultTarget, transitionSpeed);
            
            // Only adjust rotation if we're close to the target position to avoid sudden jumps
            const distanceToTarget = camera.position.distanceTo(defaultPosition);
            if (distanceToTarget < 5) {
                // Smoothly transition camera rotation to overhead view
                const targetRotationX = -Math.PI / 2;
                const targetRotationY = 0;
                const targetRotationZ = 0;
                
                camera.rotation.x = THREE.MathUtils.lerp(camera.rotation.x, targetRotationX, transitionSpeed);
                camera.rotation.y = THREE.MathUtils.lerp(camera.rotation.y, targetRotationY, transitionSpeed);
                camera.rotation.z = THREE.MathUtils.lerp(camera.rotation.z, targetRotationZ, transitionSpeed);
            }
            
            controls.update();
        }
    }

    renderer.render(scene, camera);
}

// Add this near your OrbitControls setup (in init or after controls is created):
controls.addEventListener('start', () => {
    userIsMovingCamera = true;
});
controls.addEventListener('end', () => {
    userIsMovingCamera = false;
});

// Test function for woman model
function testWomanModel() {
    console.log('Testing woman model...');
    const womanToken = window.loadedTokenModels && window.loadedTokenModels['woman'];
    if (womanToken) {
        console.log('Woman token found:', womanToken);
        console.log('Woman token visible:', womanToken.visible);
        console.log('Woman token position:', womanToken.position);
        console.log('Woman token userData:', womanToken.userData);
        
        // Make it visible and position it
        womanToken.visible = true;
        womanToken.traverse(child => { child.visible = true; });
        womanToken.position.set(0, 1.5, 0);
        
        // Test animations
        if (womanToken.userData.idleAction) {
            console.log('Woman idle animation available');
            womanToken.userData.idleAction.play();
        } else {
            console.warn('Woman idle animation not available');
        }
        
        if (womanToken.userData.walkAction) {
            console.log('Woman walk animation available');
        } else {
            console.warn('Woman walk animation not available');
        }
        
        // Focus camera on woman
        if (camera && controls) {
            camera.position.set(3, 5, 3);
            controls.target.copy(womanToken.position);
            controls.update();
        }
    } else {
        console.error('Woman token not found in loadedTokenModels');
    }
}

// Test function for Rolls Royce model
function testRollsRoyce() {
    console.log('Testing Rolls Royce model...');
    const rrToken = window.loadedTokenModels && window.loadedTokenModels['rolls royce'];
    if (rrToken) {
        console.log('Rolls Royce token found:', rrToken);
        console.log('Rolls Royce token visible:', rrToken.visible);
        console.log('Rolls Royce token position:', rrToken.position);
        console.log('Rolls Royce token userData:', rrToken.userData);
        
        // Make it visible and position it
        rrToken.visible = true;
        rrToken.traverse(child => { child.visible = true; });
        rrToken.position.set(5, 1.5, 0);
        
        // Test animations
        if (rrToken.userData.actions && rrToken.userData.actions.length > 0) {
            console.log('Rolls Royce animations available:', rrToken.userData.actions.length);
            rrToken.userData.actions.forEach(action => action.play());
        } else {
            console.warn('Rolls Royce animations not available');
        }
        
        // Focus camera on Rolls Royce
        if (camera && controls) {
            camera.position.set(8, 5, 3);
            controls.target.copy(rrToken.position);
            controls.update();
        }
    } else {
        console.error('Rolls Royce token not found in loadedTokenModels');
    }
}

// Test function to show all available tokens
function testAllTokens() {
    console.log('Testing all available tokens...');
    console.log('Available tokens in window.loadedTokenModels:', window.loadedTokenModels);
    console.log('Available tokens in availableTokens array:', availableTokens);
    
    if (window.loadedTokenModels) {
        Object.keys(window.loadedTokenModels).forEach(tokenName => {
            const token = window.loadedTokenModels[tokenName];
            console.log(`Token: ${tokenName}`, {
                visible: token.visible,
                position: token.position,
                hasAnimations: !!(token.userData.actions || token.userData.idleAction || token.userData.walkAction)
            });
        });
    }
}

// Add test functions to window for debugging
window.testWomanModel = testWomanModel;
window.testRollsRoyce = testRollsRoyce;
window.testAllTokens = testAllTokens;

// --- Rolls Royce Idle Animation State ---
function startRollsRoyceIdle(animatedModel, position) {
    if (!animatedModel) return;
    stopRollsRoyceIdle();
    animatedModel.visible = true;
    // Play all actions (wheels)
    if (animatedModel.userData.actions) {
        animatedModel.userData.actions.forEach(action => action.play());
    }
    // Start engine sound if not already playing
    if (accelerationSound.paused) {
        accelerationSound.currentTime = 0;
        accelerationSound.play().catch(() => {});
    }
    // Place the car at the stopped position
    animatedModel.position.set(position.x, position.y, position.z);
    let t = 0;
    function animate() {
        t += 1 / 60;
        // Simulate a gentle engine rev: rock the car up/down and a little side-to-side
        const revAmount = Math.sin(t * 2.5) * 0.04; // up/down
        const tiltAmount = Math.sin(t * 1.7) * 0.02; // side tilt
        animatedModel.position.y = position.y + revAmount;
        animatedModel.rotation.set(tiltAmount, animatedModel.rotation.y, 0);
        if (animatedModel.userData.mixer) animatedModel.userData.mixer.update(1 / 60);
        rollsRoyceIdleAnim = requestAnimationFrame(animate);
    }
    rollsRoyceIdleAnim = requestAnimationFrame(animate);
}

function stopRollsRoyceIdle() {
    if (rollsRoyceIdleAnim) {
        cancelAnimationFrame(rollsRoyceIdleAnim);
        rollsRoyceIdleAnim = null;
    }
    // Do NOT stop accelerationSound here; let it play as long as the token is visible
}

function startHatIdle(token) {
    stopHatIdle();
    let t = 0;
    const baseY = token.position.y;
    function animate() {
        t += 1 / 60;
        token.rotation.y += 0.02; // gentle spin
        token.position.y = baseY + Math.sin(t * 1.2) * 0.18; // gentle bob
        hatIdleAnim = requestAnimationFrame(animate);
    }
    hatIdleAnim = requestAnimationFrame(animate);
}
function stopHatIdle() {
    if (hatIdleAnim) {
        cancelAnimationFrame(hatIdleAnim);
        hatIdleAnim = null;
    }
}

function startBurgerIdle(token) {
    stopBurgerIdle();
    let t = 0;
    const baseY = token.position.y;
    const baseScale = token.scale.clone();
    function animate() {
        t += 1 / 60;
        token.rotation.y += 0.015; // slow spin
        token.position.y = baseY + Math.sin(t * 1.1) * 0.12;
        const squish = 1 - Math.abs(Math.sin(t * 0.7)) * 0.08;
        token.scale.set(baseScale.x, baseScale.y * squish, baseScale.z);
        burgerIdleAnim = requestAnimationFrame(animate);
    }
    burgerIdleAnim = requestAnimationFrame(animate);
}
function stopBurgerIdle() {
    if (burgerIdleAnim) {
        cancelAnimationFrame(burgerIdleAnim);
        burgerIdleAnim = null;
    }
}

function startFootballIdle(token) {
    stopFootballIdle();
    let t = 0;
    const baseY = token.position.y;
    function animate() {
        t += 1 / 60;
        token.position.y = baseY + Math.sin(t * 1.5) * 0.18;
        token.rotation.y += 0.07; // spin
        token.rotation.x = Math.sin(t * 1.1) * 0.18;
        token.rotation.z = Math.cos(t * 0.8) * 0.13;
        footballIdleAnim = requestAnimationFrame(animate);
    }
    footballIdleAnim = requestAnimationFrame(animate);
}
function stopFootballIdle() {
    if (footballIdleAnim) {
        cancelAnimationFrame(footballIdleAnim);
        footballIdleAnim = null;
    }
}

function startNikeIdle(token) {
    stopNikeIdle();
    let t = 0;
    const baseY = token.position.y;
    function animate() {
        t += 1 / 60;
        token.position.y = baseY + Math.abs(Math.sin(t * 1.3)) * 0.22;
        token.rotation.z = Math.sin(t * 1.3) * 0.18;
        token.rotation.y += 0.01; // slow spin
        nikeIdleAnim = requestAnimationFrame(animate);
    }
    nikeIdleAnim = requestAnimationFrame(animate);
}
function stopNikeIdle() {
    if (nikeIdleAnim) {
        cancelAnimationFrame(nikeIdleAnim);
        nikeIdleAnim = null;
    }
}

// ===== VIDEO CHAT SYSTEM =====

// Initialize Video Chat System
function initVideoChat() {
    try {
        // Get DOM elements
        videoChatToggleBtn = document.getElementById('video-chat-toggle-btn');
        videoChatContainer = document.getElementById('video-chat-container');
        videoGrid = document.getElementById('video-grid');
        toggleVideoBtn = document.getElementById('toggle-video-btn');
        toggleAudioBtn = document.getElementById('toggle-audio-btn');
        leaveBtn = document.getElementById('leave-btn');
        minimizeBtn = document.getElementById('minimize-btn');
        videoStatus = document.getElementById('video-status');

        // Check if video chat elements exist (only in game.html)
        if (!videoChatToggleBtn || !videoChatContainer) {
            console.log('Video chat elements not found - not in game.html');
            return;
        }

        // Add event listeners
        if (videoChatToggleBtn) {
            videoChatToggleBtn.addEventListener('click', toggleVideoChat);
        }
        if (toggleVideoBtn) {
            toggleVideoBtn.addEventListener('click', toggleVideo);
        }
        if (toggleAudioBtn) {
            toggleAudioBtn.addEventListener('click', toggleAudio);
        }
        if (leaveBtn) {
            leaveBtn.addEventListener('click', leaveVideoChat);
        }
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', toggleMinimize);
        }

        console.log('Video chat system initialized');
    } catch (error) {
        console.log('Video chat initialization failed:', error.message);
    }
}

// Create Video Box for a Player
function createVideoBox(playerIndex, playerName, isLocal = false) {
    if (typeof playerIndex === 'undefined' || playerIndex === null) {
        console.error('Invalid player index for video box creation');
        return null;
    }
    
    const videoBox = document.createElement('div');
    videoBox.className = `video-box ${isLocal ? 'local-video-box' : 'remote-video-box'}`;
    videoBox.id = `video-box-${playerIndex}`;
    
    const video = document.createElement('video');
    video.id = `video-${playerIndex}`;
    video.autoplay = true;
    video.playsinline = true;
    if (isLocal) video.muted = true;
    
    const placeholder = document.createElement('div');
    placeholder.className = 'video-placeholder';
    placeholder.id = `placeholder-${playerIndex}`;
    
    const placeholderContent = document.createElement('div');
    placeholderContent.className = 'placeholder-content';
    
    const placeholderIcon = document.createElement('span');
    placeholderIcon.className = 'placeholder-icon';
    placeholderIcon.textContent = '👤';
    
    const placeholderText = document.createElement('span');
    placeholderText.className = 'placeholder-text';
    placeholderText.textContent = isLocal ? 'You' : `Player ${playerIndex + 1}`;
    
    placeholderContent.appendChild(placeholderIcon);
    placeholderContent.appendChild(placeholderText);
    placeholder.appendChild(placeholderContent);
    
    const videoLabel = document.createElement('div');
    videoLabel.className = 'video-label';
    videoLabel.textContent = isLocal ? 'You' : playerName || `Player ${playerIndex + 1}`;
    
    videoBox.appendChild(video);
    videoBox.appendChild(placeholder);
    videoBox.appendChild(videoLabel);
    
    return videoBox;
}

// Update Video Grid Layout
function updateVideoGridLayout(playerCount) {
    if (!videoGrid || typeof playerCount === 'undefined' || playerCount < 1) {
        console.log('Cannot update video grid layout - missing elements or invalid player count');
        return;
    }
    
    // Clear existing video boxes
    videoGrid.innerHTML = '';
    videoBoxes = [];
    
    // Remove existing grid classes
    videoGrid.className = 'video-grid';
    
    // Add appropriate grid class
    if (playerCount >= 2 && playerCount <= 8) {
        videoGrid.classList.add(`grid-${playerCount}`);
    } else {
        videoGrid.classList.add('grid-2'); // Default fallback
    }
    
    // Create video boxes for each player
    for (let i = 0; i < playerCount; i++) {
        const isLocal = i === 0; // First player is local
        const playerName = players[i] ? players[i].name : `Player ${i + 1}`;
        const videoBox = createVideoBox(i, playerName, isLocal);
        
        if (videoBox) {
            videoGrid.appendChild(videoBox);
            videoBoxes.push(videoBox);
        }
    }
    
    currentPlayerCount = playerCount;
    console.log(`Created ${playerCount} video boxes`);
}

// Get Video Elements by Index
function getVideoElement(playerIndex) {
    if (typeof playerIndex === 'undefined' || playerIndex === null) return null;
    return document.getElementById(`video-${playerIndex}`);
}

function getPlaceholderElement(playerIndex) {
    if (typeof playerIndex === 'undefined' || playerIndex === null) return null;
    return document.getElementById(`placeholder-${playerIndex}`);
}

// Main Toggle Function
async function toggleVideoChat() {
    if (typeof videoChatActive === 'undefined' || !videoChatActive) {
        await startVideoChat();
    } else {
        stopVideoChat();
    }
}

// Start Video Chat
async function startVideoChat() {
    try {
        // Check if video chat elements exist
        if (!videoChatContainer || !videoChatToggleBtn) {
            console.log('Video chat elements not found');
            return;
        }
        
        updateVideoStatus('Connecting...');
        
        // Determine player count (use actual game state)
        const playerCount = Math.max(2, players.filter(p => p.selectedToken !== null).length);
        
        // Update video grid layout based on player count
        updateVideoGridLayout(playerCount);

        // Check if getUserMedia is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.log('getUserMedia not supported, using demo mode');
            updateVideoStatus('Browser does not support camera access - using demo mode');
            localStream = createSimulatedStream();
        } else {
            // Try to get user media with fallback options
            let mediaConstraints = {
                video: true,
                audio: true
            };

            try {
                // First try with video and audio
                localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
        } catch (videoError) {
            console.log('Video/audio failed, trying audio only...');
            updateVideoStatus('Camera not found, trying audio only...');
            try {
                // Try audio only
                localStream = await navigator.mediaDevices.getUserMedia({
                    video: false,
                    audio: true
                });
                updateVideoStatus('Audio only mode - camera not available');
            } catch (audioError) {
                console.log('Audio failed, creating simulated stream...');
                updateVideoStatus('Creating demo mode - no devices found');
                // Create a simulated stream for demo purposes
                localStream = createSimulatedStream();
                updateVideoStatus('Demo mode active - simulated video stream');
            }
        }
        }

        // Display local video (player 0)
        const localVideo = getVideoElement(0);
        const localPlaceholder = getPlaceholderElement(0);
        
        if (localVideo && localPlaceholder) {
            localVideo.srcObject = localStream;
            localVideo.classList.add('active');
            localPlaceholder.classList.add('hidden');
        }

        // Show video chat container
        videoChatContainer.classList.add('show');
        
        // Update toggle button
        videoChatToggleBtn.classList.add('active');
        videoChatToggleBtn.textContent = '🔴';
        videoChatToggleBtn.title = 'Stop Video Chat';

        // Initialize peer connection (simulated for demo)
        initializePeerConnection(playerCount);

        videoChatActive = true;
        updateVideoStatus(`Waiting for ${playerCount - 1} opponent(s)...`);
        
        console.log(`Video chat started successfully with ${playerCount} players`);
        
    } catch (error) {
        console.error('Error starting video chat:', error);
        handleVideoError(error);
    }
}

// Stop Video Chat
function stopVideoChat() {
    try {
        // Check if video chat elements exist
        if (!videoChatContainer || !videoChatToggleBtn) {
            console.log('Video chat elements not found');
            return;
        }
        
        // Stop all tracks
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }

        // Close peer connection
        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }

        // Hide all videos and show placeholders
        for (let i = 0; i < currentPlayerCount; i++) {
            const video = getVideoElement(i);
            const placeholder = getPlaceholderElement(i);
            
            if (video) video.classList.remove('active');
            if (placeholder) placeholder.classList.remove('hidden');
        }

        // Hide container
        videoChatContainer.classList.remove('show');
        videoChatContainer.classList.remove('minimized');

        // Reset toggle button
        videoChatToggleBtn.classList.remove('active');
        videoChatToggleBtn.textContent = 'Video Chat';
        videoChatToggleBtn.title = 'Start Video Chat';

        // Reset states
        videoChatActive = false;
        isMinimized = false;
        isVideoEnabled = true;
        isAudioEnabled = true;

        // Reset button states
        updateVideoButtonState();
        updateAudioButtonState();

        updateVideoStatus('Disconnected');
        
        console.log('Video chat stopped');
        
    } catch (error) {
        console.error('Error stopping video chat:', error);
    }
}

// Initialize Peer Connection (Simulated)
function initializePeerConnection(playerCount) {
    // This is a simplified implementation
    // In a real app, you'd use WebRTC with a signaling server
    
    // Simulate opponents joining after 2 seconds
    setTimeout(() => {
        if (videoChatActive) {
            simulateOpponentsJoin(playerCount);
        }
    }, 2000);
}

// Simulate Opponents Joining
function simulateOpponentsJoin(playerCount) {
    if (!videoChatActive) return;
    
    // Simulate each opponent joining with a delay
    for (let i = 1; i < playerCount; i++) {
        setTimeout(() => {
            if (videoChatActive) {
                simulateOpponentJoin(i);
            }
        }, i * 1000); // Stagger the joins
    }
}

// Simulate Single Opponent Joining
function simulateOpponentJoin(playerIndex) {
    if (!videoChatActive) return;
    
    // Create a simulated remote stream (black video with text)
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    
    // Draw a simulated video frame
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Player ${playerIndex + 1} Video`, canvas.width / 2, canvas.height / 2);
    
    // Create a stream from the canvas
    const stream = canvas.captureStream(30);
    
    // Display remote video
    const remoteVideo = getVideoElement(playerIndex);
    const remotePlaceholder = getPlaceholderElement(playerIndex);
    
    if (remoteVideo && remotePlaceholder) {
        remoteVideo.srcObject = stream;
        remoteVideo.classList.add('active');
        remotePlaceholder.classList.add('hidden');
    }
    
    const connectedCount = videoBoxes.filter(box => 
        box.querySelector('video.active')
    ).length;
    
    updateVideoStatus(`${connectedCount}/${currentPlayerCount} players connected`);
    
    console.log(`Simulated player ${playerIndex + 1} joined`);
}

// Toggle Video
function toggleVideo() {
    if (!localStream) return;
    
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        isVideoEnabled = !isVideoEnabled;
        videoTrack.enabled = isVideoEnabled;
        updateVideoButtonState();
        
        console.log('Video toggled:', isVideoEnabled ? 'ON' : 'OFF');
    }
}

// Toggle Audio
function toggleAudio() {
    if (!localStream) return;
    
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        isAudioEnabled = !isAudioEnabled;
        audioTrack.enabled = isAudioEnabled;
        updateAudioButtonState();
        
        console.log('Audio toggled:', isAudioEnabled ? 'ON' : 'OFF');
    }
}

// Leave Video Chat
function leaveVideoChat() {
    stopVideoChat();
}

// Toggle Minimize
function toggleMinimize() {
    isMinimized = !isMinimized;
    
    if (isMinimized) {
        videoChatContainer.classList.add('minimized');
        minimizeBtn.textContent = '+';
        minimizeBtn.title = 'Expand';
    } else {
        videoChatContainer.classList.remove('minimized');
        minimizeBtn.textContent = '−';
        minimizeBtn.title = 'Minimize';
    }
}

// Update Video Button State
function updateVideoButtonState() {
    if (!toggleVideoBtn) return;
    
    if (isVideoEnabled) {
        toggleVideoBtn.textContent = '🔴';
        toggleVideoBtn.title = 'Turn Video Off';
        toggleVideoBtn.classList.remove('muted');
    } else {
        toggleVideoBtn.textContent = '📹';
        toggleVideoBtn.title = 'Turn Video On';
        toggleVideoBtn.classList.add('muted');
    }
}

// Update Audio Button State
function updateAudioButtonState() {
    if (!toggleAudioBtn) return;
    
    if (isAudioEnabled) {
        toggleAudioBtn.textContent = '🔊';
        toggleAudioBtn.title = 'Mute Audio';
        toggleAudioBtn.classList.remove('muted');
    } else {
        toggleAudioBtn.textContent = '🔇';
        toggleAudioBtn.title = 'Unmute Audio';
        toggleAudioBtn.classList.add('muted');
    }
}

// Update Video Status
function updateVideoStatus(message) {
    if (videoStatus && typeof message === 'string') {
        videoStatus.textContent = message;
    }
}

// Create Simulated Stream for Demo
function createSimulatedStream() {
    // Create a canvas element
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    
    // Create a simple animated pattern
    let frame = 0;
    function drawFrame() {
        // Clear canvas
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw animated circles
        const time = Date.now() * 0.001;
        for (let i = 0; i < 5; i++) {
            const x = canvas.width / 2 + Math.cos(time + i) * 100;
            const y = canvas.height / 2 + Math.sin(time + i * 0.7) * 100;
            const radius = 20 + Math.sin(time * 2 + i) * 10;
            
            ctx.fillStyle = `hsl(${120 + i * 60}, 70%, 60%)`;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Add text
        ctx.fillStyle = '#ecf0f1';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Demo Video Stream', canvas.width / 2, canvas.height - 50);
        ctx.fillText('Camera not available', canvas.width / 2, canvas.height - 20);
        
        frame++;
        requestAnimationFrame(drawFrame);
    }
    
    drawFrame();
    
    // Convert canvas to stream
    const stream = canvas.captureStream(30); // 30 FPS
    
    // Add a silent audio track to make it a valid MediaStream
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const destination = audioContext.createMediaStreamDestination();
    oscillator.connect(destination);
    oscillator.frequency.setValueAtTime(0, audioContext.currentTime); // Silent
    oscillator.start();
    
    // Combine video and audio streams
    const combinedStream = new MediaStream([
        ...stream.getVideoTracks(),
        ...destination.stream.getAudioTracks()
    ]);
    
    return combinedStream;
}

// Handle Video Errors
function handleVideoError(error) {
    let errorMessage = 'An error occurred';
    
    if (error && error.name === 'NotAllowedError') {
        errorMessage = 'Camera/microphone access denied';
    } else if (error && error.name === 'NotFoundError') {
        errorMessage = 'No camera/microphone found - using demo mode';
    } else if (error && error.name === 'NotReadableError') {
        errorMessage = 'Camera/microphone is busy';
    } else if (error && error.name === 'OverconstrainedError') {
        errorMessage = 'Camera/microphone not supported';
    }
    
    updateVideoStatus(errorMessage);
    console.error('Video chat error:', error);
    
    // Reset toggle button
    if (videoChatToggleBtn) {
        videoChatToggleBtn.classList.remove('active');
        videoChatToggleBtn.textContent = 'Video Chat';
        videoChatToggleBtn.title = 'Start Video Chat';
    }
}

// Create Placeholder Video
function createPlaceholderVideo() {
    // This is handled by the HTML structure
    // Placeholders are already created and shown by default
}

// Remove Placeholder Video
function removePlaceholderVideo(playerIndex) {
    const placeholder = getPlaceholderElement(playerIndex);
    if (placeholder) {
        placeholder.classList.add('hidden');
    }
}

// Handle Remote Stream
function handleRemoteStream(stream, playerIndex) {
    const video = getVideoElement(playerIndex);
    if (video) {
        video.srcObject = stream;
        video.classList.add('active');
        removePlaceholderVideo(playerIndex);
        
        const connectedCount = videoBoxes.filter(box => 
            box.querySelector('video.active')
        ).length;
        
        updateVideoStatus(`${connectedCount}/${currentPlayerCount} players connected`);
    }
}

// Remove Peer Connection
function removePeerConnection(playerIndex) {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    // Show placeholder for the specific player
    const video = getVideoElement(playerIndex);
    const placeholder = getPlaceholderElement(playerIndex);
    
    if (video) video.classList.remove('active');
    if (placeholder) placeholder.classList.remove('hidden');
    
    const connectedCount = videoBoxes.filter(box => 
        box.querySelector('video.active')
    ).length;
    
    updateVideoStatus(`${connectedCount}/${currentPlayerCount} players connected`);
}

// Video chat is initialized from the main init() function
// No need for additional initialization here

// Update Video Chat for Game State Changes
function updateVideoChatForGameState() {
    // Check if video chat is available and active
    if (typeof videoChatActive !== 'undefined' && videoChatActive && videoChatContainer) {
        const playerCount = Math.max(2, players.filter(p => p.selectedToken !== null).length);
        
        if (playerCount !== currentPlayerCount) {
            console.log(`Updating video chat from ${currentPlayerCount} to ${playerCount} players`);
            updateVideoGridLayout(playerCount);
            
            // Re-display local video if it exists
            if (localStream) {
                const localVideo = getVideoElement(0);
                const localPlaceholder = getPlaceholderElement(0);
                
                if (localVideo && localPlaceholder) {
                    localVideo.srcObject = localStream;
                    localVideo.classList.add('active');
                    localPlaceholder.classList.add('hidden');
                }
            }
            
            // Re-simulate opponents if needed
            setTimeout(() => {
                if (videoChatActive) {
                    simulateOpponentsJoin(playerCount);
                }
            }, 1000);
        }
    }
}

// Export functions for potential external use
window.VideoChat = {
    start: startVideoChat,
    stop: stopVideoChat,
    toggleVideo: toggleVideo,
    toggleAudio: toggleAudio,
    leave: leaveVideoChat,
    minimize: toggleMinimize,
    updateForGameState: updateVideoChatForGameState
};

// Export main game functions for multiplayer
window.init = init;
window.scene = scene;
window.players = players;
window.rollDice = rollDice;
window.buyProperty = buyProperty;
window.endTurn = endTurn;
window.moveToken = moveToken;
window.getBoardSquarePosition = getBoardSquarePosition;
window.updateMoneyDisplay = updateMoneyDisplay;
window.createTokens = createTokens;
window.createPlayerTokenSelectionUI = createPlayerTokenSelectionUI;
window.initPlayerTokenSelection = initPlayerTokenSelection;
window.createDiceButton = createDiceButton;
window.startTurn = startTurn;
window.startPlayerTurn = startPlayerTurn;
window.validateGameState = validateGameState;
window.initializePlayers = initializePlayers;
window.currentPlayerIndex = currentPlayerIndex;
window.allowedToRoll = allowedToRoll;
window.isTurnInProgress = isTurnInProgress;
window.showTurnIndicator = showTurnIndicator;
window.showNotification = showNotification;
window.updateVideoChatForGameState = updateVideoChatForGameState;
window.initVideoChat = initVideoChat;
window.finishMove = finishMove;
window.handlePropertyLanding = handlePropertyLanding;

// Signal that the script has loaded
console.log('Script.js loaded and exports set');
document.dispatchEvent(new CustomEvent('scriptLoaded'));

// ===== MULTIPLAYER HELPER FUNCTIONS =====

function checkMultiplayerMode() {
    // Check URL parameters for multiplayer mode
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room');
    const playerId = urlParams.get('player');
    
    if (roomId && playerId) {
        isMultiplayerMode = true;
        currentRoomId = roomId;
        currentPlayerId = playerId;
        console.log('Multiplayer mode detected:', { roomId, playerId });
    }
}

function initializeMultiplayerGame() {
    if (!isMultiplayerMode) return;
    
    console.log('Initializing multiplayer game...');
    
    // Load multiplayer.js script if not already loaded
    if (!window.MultiplayerGame) {
        const script = document.createElement('script');
        script.src = 'multiplayer.js';
        script.onload = () => {
            console.log('Multiplayer script loaded');
            startMultiplayerGame();
        };
        script.onerror = (error) => {
            console.error('Failed to load multiplayer script:', error);
        };
        document.head.appendChild(script);
    } else {
        startMultiplayerGame();
    }
}

function startMultiplayerGame() {
    if (!window.MultiplayerGame) {
        console.error('MultiplayerGame class not found');
        return;
    }
    
    try {
        multiplayerGame = new window.MultiplayerGame(currentRoomId, currentPlayerId);
        window.multiplayerGame = multiplayerGame; // Set it on window object
        console.log('Multiplayer game started successfully');
    } catch (error) {
        console.error('Failed to start multiplayer game:', error);
    }
}

// Override game functions for multiplayer
function overrideGameFunctionsForMultiplayer() {
    if (!isMultiplayerMode) return;
    
    // Override rollDice function
    const originalRollDice = window.rollDice;
    window.rollDice = function() {
        if (multiplayerGame && multiplayerGame.isMyTurn) {
            multiplayerGame.rollDice();
        } else {
            console.log('Not your turn or multiplayer not ready');
        }
    };
    
    // Override endTurn function
    const originalEndTurn = window.endTurn;
    window.endTurn = function() {
        if (multiplayerGame) {
            multiplayerGame.endTurn();
        } else {
            originalEndTurn();
        }
    };
    
    // Override buyProperty function
    const originalBuyProperty = window.buyProperty;
    window.buyProperty = function(player, property, callback) {
        if (multiplayerGame && isMultiplayerMode) {
            multiplayerGame.buyProperty(property.name, property.price);
            if (callback) callback();
        } else {
            originalBuyProperty(player, property, callback);
        }
    };
}

// Call override functions when multiplayer is ready
if (isMultiplayerMode) {
    setTimeout(overrideGameFunctionsForMultiplayer, 1000);
}