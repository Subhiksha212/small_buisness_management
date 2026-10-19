import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import {
  createSale,
  createExpense,
  getTransactions,
  getProducts,
  createProduct,
  lookupProduct,
  seedSampleProducts,
} from '../services/api';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import jsQR from 'jsqr';
import { createWorker } from 'tesseract.js';
import { parseReceiptText } from '../utils/billParser';

import { QRCodeSVG } from 'qrcode.react';
import {
  Scan,
  QrCode,
  Camera,
  Upload,
  CheckCircle2,
  XCircle,
  Plus,
  Minus,
  ShoppingCart,
  Trash2,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Printer,
  Tag,
  AlertTriangle,
  HelpCircle,
  FileText,
  DollarSign,
  Package,
  Layers,
  Zap,
  Check,
  RotateCcw,
  RotateCw,
  Store,
  ExternalLink,
  Info,
  ReceiptText,
  CameraOff,
  Eye,
  EyeOff,
  Copy,
  Calendar,
  Hash,
  SlidersHorizontal,
} from 'lucide-react';

// Formats supported for both camera & image uploads
const supportedBarcodeFormats = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.DATA_MATRIX,
  Html5QrcodeSupportedFormats.AZTEC,
  Html5QrcodeSupportedFormats.ITF,
];

// Web Audio API POS scanner chirp generator
const playScanChime = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.16);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.16);
  } catch {
    // Ignore audio playback restriction on locked gestures
  }
};

const ScanBill = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  // Top Tab Navigation: 'productQr' | 'ocrBill' | 'qrHub'
  const [activeTab, setActiveTab] = useState('productQr');

  // ==========================================
  // TAB 1: PRODUCT QR SCANNER STATE
  // ==========================================
  const [scannerMode, setScannerMode] = useState('camera'); // 'camera' | 'upload' | 'demo'
  const [isCameraRunning, setIsCameraRunning] = useState(false);
  const [facingMode, setFacingMode] = useState('user'); // Default to 'user' (front camera) so laptops connect immediately
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [isDetectedBlink, setIsDetectedBlink] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [qrScanningFile, setQrScanningFile] = useState(false);
  const [uploadedQrPreview, setUploadedQrPreview] = useState(null);
  const [manualCodeInput, setManualCodeInput] = useState('');


  // Scanned Product State
  const [detectedProduct, setDetectedProduct] = useState(null);
  const [scanQty, setScanQty] = useState(1);
  const [scanPaymentMethod, setScanPaymentMethod] = useState('Cash');
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Active Multi-Item Customer Bill / Cart
  const [customerBill, setCustomerBill] = useState([]);
  const [billPaymentMethod, setBillPaymentMethod] = useState('Cash');
  const [billSaving, setBillSaving] = useState(false);

  // Html5Qrcode Scanner instance ref
  const scannerRef = useRef(null);
  const isStoppingRef = useRef(false);
  const lastScannedRef = useRef({ code: '', time: 0 });


  // ==========================================
  // TAB 2: REAL OCR & LIVE CAMERA BILL SCANNER STATE
  // ==========================================
  const billVideoRef = useRef(null);
  const billStreamRef = useRef(null);
  const ocrWorkerRef = useRef(null);

  const [billScannerMode, setBillScannerMode] = useState('camera'); // 'camera' | 'upload'
  const [isBillCameraRunning, setIsBillCameraRunning] = useState(false);
  const [isBillCameraStarting, setIsBillCameraStarting] = useState(false);
  const [billVideoReady, setBillVideoReady] = useState(false);
  const [billFacingMode, setBillFacingMode] = useState('environment'); // 'environment' (back camera preferred for bills)
  const [billCameraError, setBillCameraError] = useState('');
  const [capturedBillUrl, setCapturedBillUrl] = useState(null);
  const [billRotation, setBillRotation] = useState(0);
  const [enhanceContrast, setEnhanceContrast] = useState(true);

  // OCR Processing State
  const [ocrFile, setOcrFile] = useState(null);
  const [ocrPreview, setOcrPreview] = useState(null);
  const [ocrScanning, setOcrScanning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatusText, setOcrStatusText] = useState('');
  const [ocrRawText, setOcrRawText] = useState('');
  const [showRawText, setShowRawText] = useState(false);
  const [ocrData, setOcrData] = useState(null);
  const [ocrDuplicateWarning, setOcrDuplicateWarning] = useState('');
  const [ocrShowConfirm, setOcrShowConfirm] = useState(false);
  const [ocrError, setOcrError] = useState('');
  const [ocrSaving, setOcrSaving] = useState(false);
  const [copiedRawText, setCopiedRawText] = useState(false);

  // ==========================================
  // TAB 3: PRODUCT QR GENERATOR & INVENTORY HUB
  // ==========================================
  const [productsList, setProductsList] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [searchProductQuery, setSearchProductQuery] = useState('');
  const [seedingLoading, setSeedingLoading] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProdData, setNewProdData] = useState({
    name: '',
    sku: '',
    price: '',
    costPrice: '',
    stockQuantity: '',
    category: 'Grocery',
  });
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [printingProduct, setPrintingProduct] = useState(null);

  // ==========================================
  // LOAD PRODUCTS FOR QR HUB
  // ==========================================
  const fetchProducts = useCallback(async () => {
    try {
      setLoadingProducts(true);
      const res = await getProducts();
      setProductsList(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Failed to load products for QR hub:', err);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'qrHub') {
      fetchProducts();
    }
  }, [activeTab, fetchProducts]);

  // ==========================================
  // QR CODE DECODER & PRODUCT MATCHER
  // ==========================================
  const processDecodedQrText = useCallback(
    async (decodedText) => {
      if (!decodedText || !decodedText.trim()) return;
      playScanChime();

      let parsedInfo = null;
      let rawCode = decodedText.trim();

      // 1. Try parsing JSON payload
      try {
        const json = JSON.parse(rawCode);
        if (typeof json === 'object' && json !== null) {
          parsedInfo = {
            id: json.id || json.productId || json._id,
            sku: json.sku || json.code,
            name: json.name || json.title,
            price: json.price !== undefined ? Number(json.price) : undefined,
            costPrice: json.costPrice !== undefined ? Number(json.costPrice) : undefined,
            category: json.category || 'General',
          };
          rawCode = parsedInfo.id || parsedInfo.sku || parsedInfo.name || rawCode;
        }
      } catch {
        // Not a JSON object, proceed with string logic
      }

      // 2. Try parsing formatted string e.g. "ITEM:Rice:135" or "RICE-1KG:135"
      if (!parsedInfo) {
        if (rawCode.includes(':')) {
          const parts = rawCode.split(':').map((p) => p.trim());
          if (parts.length >= 2) {
            const possiblePrice = Number(parts[parts.length - 1]);
            if (!isNaN(possiblePrice) && possiblePrice > 0) {
              parsedInfo = {
                sku: parts[0] !== 'PROD' && parts[0] !== 'ITEM' ? parts[0] : parts[1] || 'SKU-SCAN',
                name: parts[0] !== 'PROD' && parts[0] !== 'ITEM' ? parts[0] : 'Scanned Product',
                price: possiblePrice,
              };
              rawCode = parsedInfo.sku;
            }
          }
        }
      }

      // 3. Check Backend Catalog for exact/fuzzy match
      let matchedDbProd = null;
      try {
        matchedDbProd = await lookupProduct(rawCode);
      } catch {
        // Not found in database or offline
      }

      if (matchedDbProd) {
        setDetectedProduct({
          _id: matchedDbProd._id,
          name: matchedDbProd.name,
          sku: matchedDbProd.sku || rawCode,
          price: Number(matchedDbProd.price),
          costPrice: Number(matchedDbProd.costPrice || 0),
          stockQuantity: matchedDbProd.stockQuantity,
          category: matchedDbProd.category || 'General',
          isDbProduct: true,
        });
      } else if (parsedInfo && (parsedInfo.price !== undefined || parsedInfo.name)) {
        setDetectedProduct({
          _id: parsedInfo.id || null,
          name: parsedInfo.name || `Scanned Item (${rawCode.slice(0, 12)})`,
          sku: parsedInfo.sku || rawCode,
          price: parsedInfo.price || 100,
          costPrice: parsedInfo.costPrice || 0,
          stockQuantity: 'Ad-hoc catalog item',
          category: parsedInfo.category || 'General',
          isDbProduct: false,
        });
      } else {
        // Fallback: Code recognized, ready for user review/custom price
        setDetectedProduct({
          _id: null,
          name: `Product #${rawCode.slice(0, 16)}`,
          sku: rawCode,
          price: 99,
          costPrice: 0,
          stockQuantity: 'Custom item',
          category: 'General',
          isDbProduct: false,
        });
      }

      setScanQty(1);
      setSaveSuccessMsg('');
    },
    []
  );

  // ==========================================
  // CAMERA SCANNER ENGINE (jsQR + BarcodeDetector + html5-qrcode)
  // ==========================================
  const isCameraRunningRef = useRef(false);
  const videoStreamRef = useRef(null);
  const videoElementRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const offscreenCanvasRef = useRef(null);
  const barcodeDetectorRef = useRef(null);

  // Initialize BarcodeDetector if browser supports it
  useEffect(() => {
    if ('BarcodeDetector' in window) {
      try {
        window.BarcodeDetector.getSupportedFormats().then((formats) => {
          if (formats && formats.length > 0) {
            barcodeDetectorRef.current = new window.BarcodeDetector({ formats });
          }
        }).catch(() => {
          // Ignore format probe error
        });
      } catch {
        // BarcodeDetector not usable
      }
    }
  }, []);

  // Frame decoding worker function using jsQR + canvas
  const decodeVideoFrame = useCallback(() => {
    const video = videoElementRef.current;
    if (!video || video.readyState < 2) return null;

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;

    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
    }
    const canvas = offscreenCanvasRef.current;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    // 1. Draw raw video frame
    ctx.drawImage(video, 0, 0, w, h);
    const imgData = ctx.getImageData(0, 0, w, h);

    // Pass A: jsQR (handles normal and inverted colors)
    let qr = jsQR(imgData.data, w, h, { inversionAttempts: 'attemptBoth' });
    if (qr && qr.data && qr.data.trim()) {
      return qr.data.trim();
    }

    // Pass B: Horizontally mirrored frame (crucial for front-facing laptop webcams that mirror)
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();
    const flippedData = ctx.getImageData(0, 0, w, h);
    qr = jsQR(flippedData.data, w, h, { inversionAttempts: 'attemptBoth' });
    if (qr && qr.data && qr.data.trim()) {
      return qr.data.trim();
    }

    // Pass C: Center 65% crop (sharpens detection when QR code is small or held far away)
    const cropW = Math.floor(w * 0.65);
    const cropH = Math.floor(h * 0.65);
    const cropX = Math.floor((w - cropW) / 2);
    const cropY = Math.floor((h - cropH) / 2);
    const centerData = ctx.getImageData(cropX, cropY, cropW, cropH);
    qr = jsQR(centerData.data, cropW, cropH, { inversionAttempts: 'attemptBoth' });
    if (qr && qr.data && qr.data.trim()) {
      return qr.data.trim();
    }

    return null;
  }, []);

  const stopCameraScanner = useCallback(async () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      videoStreamRef.current = null;
    }

    if (videoElementRef.current) {
      videoElementRef.current.srcObject = null;
      videoElementRef.current = null;
    }

    if (scannerRef.current && !isStoppingRef.current) {
      try {
        isStoppingRef.current = true;
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch {
        // ignore
      } finally {
        scannerRef.current = null;
        isStoppingRef.current = false;
      }
    }

    isCameraRunningRef.current = false;
    setIsCameraRunning(false);
  }, []);

  const startCameraScanner = useCallback(async () => {
    const readerElement = document.getElementById('qr-reader');
    if (!readerElement) return;

    setCameraError('');

    try {
      // 1. Stop any running camera streams first
      await stopCameraScanner();

      // 2. Discover available camera devices
      if (navigator.mediaDevices?.enumerateDevices) {
        try {
          const allDevices = await navigator.mediaDevices.enumerateDevices();
          const videoInputs = allDevices.filter((d) => d.kind === 'videoinput');
          setAvailableCameras(videoInputs);
        } catch {
          // enumerate devices fallback
        }
      }

      // 3. Setup video constraints (request 1080p/720p for crisp QR resolution)
      const constraints = {
        video: selectedCameraId
          ? { deviceId: { exact: selectedCameraId }, width: { ideal: 1920, min: 1280 }, height: { ideal: 1080, min: 720 } }
          : { facingMode: facingMode, width: { ideal: 1920, min: 1280 }, height: { ideal: 1080, min: 720 } },
        audio: false,
      };

      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch {
        // Fallback to basic constraints if high-res was rejected by driver
        stream = await navigator.mediaDevices.getUserMedia({
          video: selectedCameraId ? { deviceId: { exact: selectedCameraId } } : { facingMode: facingMode },
          audio: false,
        });
      }

      videoStreamRef.current = stream;

      // 4. Render video element into the viewfinder
      readerElement.innerHTML = '';
      const video = document.createElement('video');
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('autoplay', 'true');
      video.muted = true;
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'cover';
      video.style.borderRadius = '14px';
      video.style.display = 'block';

      readerElement.appendChild(video);
      videoElementRef.current = video;

      await video.play();

      isCameraRunningRef.current = true;
      setIsCameraRunning(true);

      // 5. Start ultra-responsive continuous decoding loop (runs every 100ms / 10 FPS)
      scanIntervalRef.current = setInterval(async () => {
        if (!isCameraRunningRef.current || !videoElementRef.current) return;

        // Primary: jsQR multi-pass frame decoding
        let detected = decodeVideoFrame();

        // Secondary: Native BarcodeDetector if available
        if (!detected && barcodeDetectorRef.current && video.readyState >= 2) {
          try {
            const results = await barcodeDetectorRef.current.detect(video);
            if (results && results.length > 0 && results[0].rawValue) {
              detected = results[0].rawValue.trim();
            }
          } catch {
            // ignore frame detector noise
          }
        }

        if (detected) {
          const now = Date.now();
          // Debounce repeated triggers of the same code within 2.5s
          if (
            lastScannedRef.current.code === detected &&
            now - lastScannedRef.current.time < 2500
          ) {
            return;
          }
          lastScannedRef.current = { code: detected, time: now };

          // Visual green flash feedback
          setIsDetectedBlink(true);
          setTimeout(() => setIsDetectedBlink(false), 600);

          processDecodedQrText(detected);
        }
      }, 100);

    } catch (err) {
      console.warn('Camera start issue:', err);
      isCameraRunningRef.current = false;
      setIsCameraRunning(false);
      setCameraError(
        'Camera access not available or blocked in this browser. Please allow camera permissions, or use "Upload Image" / "Quick Demo Items" below.'
      );
    }
  }, [facingMode, selectedCameraId, decodeVideoFrame, processDecodedQrText, stopCameraScanner]);

  // Lifecycle when camera tab or mode changes
  useEffect(() => {
    if (activeTab === 'productQr' && scannerMode === 'camera') {
      const timer = setTimeout(() => {
        startCameraScanner();
      }, 350);
      return () => {
        clearTimeout(timer);
        stopCameraScanner();
      };
    } else {
      stopCameraScanner();
    }
  }, [activeTab, scannerMode, facingMode, selectedCameraId, startCameraScanner, stopCameraScanner]);

  // Switch between front and back camera
  const handleToggleFacingMode = async () => {
    await stopCameraScanner();
    setSelectedCameraId('');
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // ==========================================
  // IMAGE UPLOAD QR & BARCODE SCANNER (jsQR + BarcodeDetector + html5-qrcode)
  // ==========================================
  const handleQrImageUpload = useCallback(async (fileOrEvent) => {
    const file = fileOrEvent?.target?.files?.[0] || fileOrEvent;
    if (!file || !(file instanceof Blob)) return;

    setUploadedQrPreview(URL.createObjectURL(file));
    setQrScanningFile(true);
    setCameraError('');
    setSaveSuccessMsg('');

    try {
      let decodedText = null;

      // Check 1: Canvas + jsQR (supports normal, inverted, and flipped)
      try {
        const img = new Image();
        const imgUrl = URL.createObjectURL(file);
        img.src = imgUrl;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });

        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        // Raw & Inverted attempt
        let qr = jsQR(imgData.data, canvas.width, canvas.height, {
          inversionAttempts: 'attemptBoth',
        });
        if (qr && qr.data && qr.data.trim()) {
          decodedText = qr.data.trim();
        }

        // Flipped attempt
        if (!decodedText) {
          ctx.save();
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          ctx.restore();
          const flippedData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          qr = jsQR(flippedData.data, canvas.width, canvas.height, {
            inversionAttempts: 'attemptBoth',
          });
          if (qr && qr.data && qr.data.trim()) {
            decodedText = qr.data.trim();
          }
        }

        // Native BarcodeDetector on image
        if (!decodedText && barcodeDetectorRef.current) {
          try {
            const barcodes = await barcodeDetectorRef.current.detect(img);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              decodedText = barcodes[0].rawValue.trim();
            }
          } catch {
            // ignore
          }
        }

        URL.revokeObjectURL(imgUrl);
      } catch (canvasErr) {
        console.warn('Canvas decode step skipped:', canvasErr);
      }

      // Check 2: Html5Qrcode scanFile fallback
      if (!decodedText) {
        try {
          const html5QrCode = new Html5Qrcode('qr-hidden-file-decoder', {
            formatsToSupport: supportedBarcodeFormats,
            verbose: false,
          });
          decodedText = await html5QrCode.scanFile(file, true);
          await html5QrCode.clear();
        } catch {
          // ignore
        }
      }

      if (decodedText && decodedText.trim()) {
        processDecodedQrText(decodedText.trim());
      } else {
        throw new Error('NotFoundException');
      }
    } catch (err) {
      console.warn('File decode error:', err);
      setCameraError(
        'No QR code detected in this image. Tip: Ensure the photo is clear, or copy & paste screenshot (Ctrl+V), or enter product name/code manually below.'
      );
    } finally {
      setQrScanningFile(false);
    }
  }, [processDecodedQrText]);

  // Global Clipboard Paste Support (Ctrl+V image directly to scan!)
  useEffect(() => {
    const handlePaste = (e) => {
      if (activeTab !== 'productQr') return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type && item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            handleQrImageUpload(blob);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [activeTab, handleQrImageUpload]);


  // ==========================================
  // QUICK DEMO TEST ITEMS (Instant Simulation)
  // ==========================================
  const demoItems = [
    {
      name: 'India Gate Basmati Rice 1kg',
      sku: 'RICE-BAS-1KG',
      price: 135,
      costPrice: 105,
      category: 'Grocery',
      emoji: '🌾',
    },
    {
      name: 'Amul Butter 500g',
      sku: 'AMUL-BTR-500G',
      price: 275,
      costPrice: 240,
      category: 'Dairy',
      emoji: '🧈',
    },
    {
      name: 'Fortune Sunflower Oil 1L',
      sku: 'OIL-SUN-1L',
      price: 160,
      costPrice: 130,
      category: 'Grocery',
      emoji: '🌻',
    },
    {
      name: 'Tata Tea Gold 250g',
      sku: 'TEA-GOLD-250G',
      price: 150,
      costPrice: 120,
      category: 'Beverages',
      emoji: '☕',
    },
    {
      name: 'Dettol Original Soap 125g (3-Pk)',
      sku: 'DETTOL-SOAP-3P',
      price: 180,
      costPrice: 145,
      category: 'Personal Care',
      emoji: '🧼',
    },
  ];

  const handleSimulateDemoScan = (item) => {
    const payload = JSON.stringify({
      id: item.sku,
      sku: item.sku,
      name: item.name,
      price: item.price,
      costPrice: item.costPrice,
      category: item.category,
    });
    processDecodedQrText(payload);
  };

  // ==========================================
  // ACTION: ADD SCANNED PRODUCT TO TRANSACTIONS
  // ==========================================
  const handleInstantQuickSale = async () => {
    if (!detectedProduct) return;

    const unitPrice = Number(detectedProduct.price) || 0;
    const quantity = Math.max(1, Number(scanQty) || 1);
    const totalAmount = unitPrice * quantity;

    if (totalAmount <= 0) {
      alert('Total price must be greater than 0.');
      return;
    }

    try {
      setSaveLoading(true);

      const salePayload = {
        amount: totalAmount,
        paymentMethod: scanPaymentMethod,
        entryMethod: 'scanned',
        description: `QR Scan: ${detectedProduct.name} (x${quantity})`,
        items: [
          {
            productId: (detectedProduct._id && /^[0-9a-fA-F]{24}$/.test(String(detectedProduct._id))) ? detectedProduct._id : undefined,
            name: detectedProduct.name,
            quantity,
            unitPrice,
            costPrice: detectedProduct.costPrice || 0,
          },
        ],

      };

      await createSale(salePayload);
      setSaveSuccessMsg(
        `Added ₹${totalAmount.toLocaleString('en-IN')} to Transactions for "${detectedProduct.name}" (Qty: ${quantity}, ${scanPaymentMethod})!`
      );
      setDetectedProduct(null);
      setScanQty(1);

      // Refresh product list if in background
      fetchProducts();
    } catch (err) {
      console.error('Failed to record quick sale:', err);
      alert('Failed to save transaction: ' + (err.response?.data?.message || err.message));
    } finally {
      setSaveLoading(false);
    }
  };

  // ==========================================
  // ACTION: ADD TO ACTIVE CUSTOMER BILL
  // ==========================================
  const handleAddToCustomerBill = () => {
    if (!detectedProduct) return;

    const qty = Math.max(1, Number(scanQty) || 1);
    const unitPrice = Number(detectedProduct.price) || 0;

    setCustomerBill((prev) => {
      // Check if product already in bill
      const existingIdx = prev.findIndex(
        (item) => (item._id && item._id === detectedProduct._id) || item.sku === detectedProduct.sku
      );

      if (existingIdx >= 0) {
        const copy = [...prev];
        const newQty = copy[existingIdx].quantity + qty;
        copy[existingIdx] = {
          ...copy[existingIdx],
          quantity: newQty,
          subtotal: copy[existingIdx].unitPrice * newQty,
        };
        return copy;
      } else {
        return [
          ...prev,
          {
            _id: detectedProduct._id || null,
            name: detectedProduct.name,
            sku: detectedProduct.sku,
            unitPrice,
            costPrice: detectedProduct.costPrice || 0,
            quantity: qty,
            subtotal: unitPrice * qty,
          },
        ];
      }
    });

    setDetectedProduct(null);
    setScanQty(1);
    setSaveSuccessMsg(`Item added to Customer Bill. Scan next product!`);
  };

  const handleUpdateBillQty = (index, delta) => {
    setCustomerBill((prev) => {
      const copy = [...prev];
      const target = copy[index];
      const newQty = target.quantity + delta;
      if (newQty <= 0) {
        return copy.filter((_, i) => i !== index);
      }
      copy[index] = {
        ...target,
        quantity: newQty,
        subtotal: target.unitPrice * newQty,
      };
      return copy;
    });
  };

  const handleRemoveBillItem = (index) => {
    setCustomerBill((prev) => prev.filter((_, i) => i !== index));
  };

  const billTotalAmount = customerBill.reduce((sum, item) => sum + item.subtotal, 0);

  // Complete and save entire customer bill to transactions
  const handleCheckoutCustomerBill = async () => {
    if (customerBill.length === 0 || billTotalAmount <= 0) return;

    try {
      setBillSaving(true);

      const itemsPayload = customerBill.map((item) => ({
        productId: (item._id && /^[0-9a-fA-F]{24}$/.test(String(item._id))) ? item._id : undefined,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        costPrice: item.costPrice || 0,
      }));


      const itemNames = customerBill.map((i) => `${i.name} (x${i.quantity})`).join(', ');

      await createSale({
        amount: billTotalAmount,
        paymentMethod: billPaymentMethod,
        entryMethod: 'scanned',
        description: `QR Bill (${customerBill.length} items): ${itemNames.slice(0, 80)}...`,
        items: itemsPayload,
      });

      setCustomerBill([]);
      setSaveSuccessMsg(
        `Customer Bill for ₹${billTotalAmount.toLocaleString('en-IN')} recorded successfully in Transactions!`
      );
      fetchProducts();
    } catch (err) {
      console.error('Failed to checkout bill:', err);
      alert('Failed to save bill: ' + (err.response?.data?.message || err.message));
    } finally {
      setBillSaving(false);
    }
  };

  // ==========================================
  // TAB 2: LIVE CAMERA BILL SCANNER & REAL OCR
  // ==========================================

  // Stop bill camera stream and release hardware tracks
  const stopBillCamera = useCallback(() => {
    if (billStreamRef.current) {
      try {
        billStreamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
      } catch (e) {
        console.warn('Error stopping bill camera tracks:', e);
      }
      billStreamRef.current = null;
    }
    if (billVideoRef.current) {
      billVideoRef.current.srcObject = null;
    }
    setIsBillCameraRunning(false);
    setIsBillCameraStarting(false);
    setBillVideoReady(false);
  }, []);

  // Start live bill camera stream with front/back toggle
  const startBillCamera = useCallback(async () => {
    if (isBillCameraStarting) return;
    setBillCameraError('');
    setIsBillCameraStarting(true);

    // Stop existing camera track before starting a new one
    if (billStreamRef.current) {
      billStreamRef.current.getTracks().forEach((t) => t.stop());
      billStreamRef.current = null;
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      setIsBillCameraStarting(false);
      setBillCameraError(
        'Camera API is not supported in this browser. Please use "Upload Receipt Image" below, or run in a secure origin (localhost or HTTPS).'
      );
      return;
    }

    try {
      let stream;
      try {
        // High resolution preferred for reading fine receipt print
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: billFacingMode },
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
          },
          audio: false,
        });
      } catch {
        // Fallback constraint if high-res was rejected by camera driver
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: billFacingMode },
          audio: false,
        });
      }

      billStreamRef.current = stream;

      if (billVideoRef.current) {
        billVideoRef.current.srcObject = stream;
        billVideoRef.current.onloadedmetadata = () => {
          setBillVideoReady(true);
          billVideoRef.current?.play().catch(() => {});
        };
      }

      setIsBillCameraRunning(true);
      setIsBillCameraStarting(false);
    } catch (err) {
      console.warn('Bill camera start error:', err);
      setIsBillCameraRunning(false);
      setIsBillCameraStarting(false);
      setBillVideoReady(false);

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setBillCameraError(
          'Camera access was denied by your browser. Please click the camera/lock icon in your address bar, allow camera permissions, and click "Start Camera".'
        );
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setBillCameraError(
          'No camera device found on this system. Please connect a webcam or switch to "Upload Receipt Image".'
        );
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setBillCameraError(
          'The camera is currently in use by another tab or app. Please close other camera programs and try again.'
        );
      } else {
        setBillCameraError(
          `Unable to access camera (${err.message || 'Unknown error'}). Please check camera permissions or use "Upload Receipt Image".`
        );
      }
    }
  }, [billFacingMode, isBillCameraStarting]);

  // Tab 2 camera lifecycle management
  useEffect(() => {
    if (activeTab === 'ocrBill' && billScannerMode === 'camera' && !ocrPreview && !ocrData) {
      const timer = setTimeout(() => {
        startBillCamera();
      }, 300);
      return () => {
        clearTimeout(timer);
        stopBillCamera();
      };
    } else {
      stopBillCamera();
    }

    return () => {
      stopBillCamera();
      if (ocrWorkerRef.current) {
        ocrWorkerRef.current.terminate().catch(() => {});
        ocrWorkerRef.current = null;
      }
    };
  }, [activeTab, billScannerMode, billFacingMode, ocrPreview, ocrData, startBillCamera, stopBillCamera]);

  // Capture current high-res camera frame
  const captureBillFrame = () => {
    const video = billVideoRef.current;
    if (!video || video.readyState < 2) {
      setBillCameraError('Camera frame is still initializing. Please wait a moment.');
      return;
    }

    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, w, h);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setCapturedBillUrl(dataUrl);
    setOcrPreview(dataUrl);
    setBillRotation(0);
    setOcrData(null);
    setOcrRawText('');
    setOcrError('');
    stopBillCamera();
  };

  // Rotate captured/uploaded image in 90-degree increments
  const rotateCapturedBill = (angleDeg = 90) => {
    if (!ocrPreview) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const isSwapped = angleDeg === 90 || angleDeg === 270;
      canvas.width = isSwapped ? img.height : img.width;
      canvas.height = isSwapped ? img.width : img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((angleDeg * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      const rotatedUrl = canvas.toDataURL('image/jpeg', 0.95);
      setCapturedBillUrl(rotatedUrl);
      setOcrPreview(rotatedUrl);
    };
    img.src = ocrPreview;
  };

  // Image preprocessing: Grayscale + dynamic contrast stretching for thermal paper receipts
  const preprocessImageForOcr = (imageSource) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(imageSource);

          ctx.drawImage(img, 0, 0);
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imgData.data;

          let minLum = 255;
          let maxLum = 0;
          for (let i = 0; i < data.length; i += 4) {
            const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            if (lum < minLum) minLum = lum;
            if (lum > maxLum) maxLum = lum;
          }

          const range = maxLum - minLum || 1;
          for (let i = 0; i < data.length; i += 4) {
            const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            let stretched = ((lum - minLum) / range) * 255;
            stretched = Math.pow(stretched / 255, 1.25) * 255;
            data[i] = stretched;
            data[i + 1] = stretched;
            data[i + 2] = stretched;
          }

          ctx.putImageData(imgData, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.95));
        } catch {
          resolve(imageSource);
        }
      };
      img.onerror = () => resolve(imageSource);
      img.src = imageSource;
    });
  };

  // Image upload handler
  const handleOcrFileSelect = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setOcrError('Selected file is not an image. Please choose a JPG, PNG, or WEBP receipt photo.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setOcrError('Image size exceeds 15MB. Please choose a smaller photo.');
      return;
    }

    setOcrFile(file);
    setOcrError('');
    setOcrData(null);
    setOcrRawText('');
    setOcrDuplicateWarning('');
    setOcrShowConfirm(false);

    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      const url = loadEvt.target.result;
      setCapturedBillUrl(url);
      setOcrPreview(url);
      stopBillCamera();
    };
    reader.readAsDataURL(file);
  };

  // Duplicate transaction checker
  const checkDuplicateBill = async (amount, merchant) => {
    if (!amount || Number(amount) <= 0) return;
    try {
      const txRes = await getTransactions();
      const list = Array.isArray(txRes) ? txRes : [];
      const match = list.find((t) => {
        const amtMatch = Math.abs(Number(t.amount) - Number(amount)) < 0.01;
        const textMatch =
          (merchant && t.description?.toLowerCase().includes(merchant.toLowerCase())) ||
          (t.paidTo && merchant && t.paidTo.toLowerCase().includes(merchant.toLowerCase())) ||
          (t.category && merchant && merchant.toLowerCase().includes(t.category.toLowerCase()));
        return amtMatch && textMatch;
      });
      if (match) {
        setOcrDuplicateWarning(
          `Duplicate Alert: A transaction for ₹${amount} matching "${merchant || match.description}" was recorded on ${new Date(
            match.date || match.createdAt
          ).toLocaleDateString('en-IN')}. Verify before saving.`
        );
      } else {
        setOcrDuplicateWarning('');
      }
    } catch {
      setOcrDuplicateWarning('');
    }
  };

  // Real Tesseract OCR recognition runner
  const handleRunRealOcr = async () => {
    const src = ocrPreview || capturedBillUrl;
    if (!src) {
      setOcrError('Please capture or upload a bill image first.');
      return;
    }

    setOcrScanning(true);
    setOcrError('');
    setOcrDuplicateWarning('');
    setOcrShowConfirm(false);
    setOcrProgress(5);
    setOcrStatusText('Initializing OCR vision engine...');

    try {
      let processedSrc = src;
      if (enhanceContrast) {
        setOcrStatusText('Enhancing receipt contrast for clear reading...');
        processedSrc = await preprocessImageForOcr(src);
      }

      setOcrProgress(15);
      setOcrStatusText('Loading language recognition models...');

      const worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            const pct = Math.min(99, Math.round((m.progress || 0) * 100));
            setOcrProgress(pct);
            setOcrStatusText(`Recognizing receipt characters... ${pct}%`);
          } else if (m.status === 'loading language traineddata') {
            setOcrStatusText('Loading English vocabulary model...');
          } else if (m.status === 'loading tesseract core') {
            setOcrStatusText('Loading OCR engine core...');
          }
        },
      });

      ocrWorkerRef.current = worker;

      const result = await worker.recognize(processedSrc);
      await worker.terminate();
      ocrWorkerRef.current = null;

      const recognizedText = result?.data?.text || '';
      setOcrRawText(recognizedText);

      if (!recognizedText.trim() || recognizedText.trim().length < 4) {
        setOcrError(
          'No readable text detected on this bill. Please ensure good lighting, hold the camera steady close to the receipt, and avoid glare.'
        );
        setOcrScanning(false);
        return;
      }

      const parsed = parseReceiptText(recognizedText, result);
      setOcrData(parsed);

      if (parsed.amount && Number(parsed.amount) > 0) {
        checkDuplicateBill(parsed.amount, parsed.merchant);
      }

      setOcrProgress(100);
      setOcrStatusText('Receipt successfully analyzed!');
    } catch (err) {
      console.error('OCR processing error:', err);
      setOcrError(
        'OCR recognition encountered an issue: ' + (err.message || 'Failed to process image. Please try again with a clearer photo.')
      );
    } finally {
      setOcrScanning(false);
    }
  };

  // Cancel in-flight OCR job
  const handleCancelOcr = async () => {
    if (ocrWorkerRef.current) {
      try {
        await ocrWorkerRef.current.terminate();
      } catch (e) {
        console.warn('Worker terminate error:', e);
      }
      ocrWorkerRef.current = null;
    }
    setOcrScanning(false);
    setOcrStatusText('');
    setOcrProgress(0);
  };

  // Save confirmed OCR transaction to MongoDB
  const handleSaveOcrTransaction = async () => {
    if (!ocrData || !ocrData.amount || Number(ocrData.amount) <= 0) {
      setOcrError('Please enter a valid positive amount.');
      return;
    }

    try {
      setOcrSaving(true);
      setOcrError('');

      if (ocrData.type === 'Sale') {
        await createSale({
          amount: Number(ocrData.amount),
          paymentMethod: ocrData.paymentMethod || 'Cash',
          description: ocrData.description || `Scanned bill from ${ocrData.merchant || 'Customer'}`,
          referenceNumber: ocrData.invoiceNumber || '',
          saleDate: ocrData.billDate || new Date().toISOString(),
          items: Array.isArray(ocrData.items) ? ocrData.items : [],
          entryMethod: 'scanned',
        });
        setSaveSuccessMsg(
          `Sale of ₹${Number(ocrData.amount).toLocaleString('en-IN')} for "${ocrData.merchant || 'Customer'}" recorded successfully in Transactions!`
        );
      } else {
        await createExpense({
          amount: Number(ocrData.amount),
          category: ocrData.category || 'Stock',
          paymentMethod: ocrData.paymentMethod || 'Cash',
          paidTo: ocrData.merchant || '',
          description: ocrData.description || `Scanned expense from ${ocrData.merchant || 'Vendor'}`,
          utrNumber: ocrData.invoiceNumber || '',
          entryMethod: 'scanned',
        });
        setSaveSuccessMsg(
          `Expense of ₹${Number(ocrData.amount).toLocaleString('en-IN')} for "${ocrData.merchant || 'Vendor'}" (${ocrData.category || 'Stock'}) recorded successfully in Transactions!`
        );
      }

      setOcrData(null);
      setCapturedBillUrl(null);
      setOcrPreview(null);
      setOcrFile(null);
      setOcrRawText('');
      setOcrShowConfirm(false);
      fetchProducts();
    } catch (err) {
      console.error('Error saving OCR transaction:', err);
      setOcrError(err.response?.data?.message || 'Failed to save scanned transaction. Please try again.');
    } finally {
      setOcrSaving(false);
    }
  };

  // ==========================================
  // TAB 3: QR HUB & CATALOG MANAGEMENT
  // ==========================================
  const handleSeedCatalog = async () => {
    try {
      setSeedingLoading(true);
      const res = await seedSampleProducts();
      alert(res.message || 'Sample products with QR codes populated!');
      fetchProducts();
    } catch (err) {
      alert('Error seeding products: ' + (err.message || 'Something went wrong'));
    } finally {
      setSeedingLoading(false);
    }
  };

  const handleCreateNewProduct = async (e) => {
    e.preventDefault();
    if (!newProdData.name.trim() || !newProdData.price) {
      alert('Product name and selling price are required.');
      return;
    }

    try {
      setCreatingProduct(true);
      await createProduct({
        name: newProdData.name.trim(),
        sku: newProdData.sku.trim() || `SKU-${Date.now().toString().slice(-6)}`,
        price: Number(newProdData.price),
        costPrice: Number(newProdData.costPrice || 0),
        stockQuantity: Number(newProdData.stockQuantity || 0),
        category: newProdData.category || 'Grocery',
      });

      setShowAddProductModal(false);
      setNewProdData({
        name: '',
        sku: '',
        price: '',
        costPrice: '',
        stockQuantity: '',
        category: 'Grocery',
      });
      fetchProducts();
    } catch (err) {
      alert('Failed to create product: ' + (err.response?.data?.message || err.message));
    } finally {
      setCreatingProduct(false);
    }
  };

  // Filtered products for QR Hub
  const filteredProducts = productsList.filter((p) => {
    const q = searchProductQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q));
  });

  return (
    <div className="scan-page-wrapper">
      {/* Offscreen hidden element for processing file scans */}
      <div
        id="qr-hidden-file-decoder"
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: '1px', height: '1px', zIndex: -10 }}
      />

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary, #0f172a)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Scan size={22} color="#0284c7" />
            <span>Product QR Scanner & Billing Station</span>
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '3px 0 0' }}>
            Scan customer product QR tags via camera or image upload to instantly record price into transactions
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/transactions')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '999px',
            padding: '6px 14px',
            fontSize: '12px',
            fontWeight: '700',
            color: '#1e293b',
            cursor: 'pointer',
            boxShadow: '0 2px 5px rgba(0,0,0,0.04)',
          }}
        >
          <ReceiptText size={14} color="#0284c7" />
          <span>View Transactions Ledger</span>
        </button>
      </div>

      {/* Main Tabs Navigation */}
      <div className="scan-tabs-bar">
        <button
          type="button"
          className={`scan-tab-btn ${activeTab === 'productQr' ? 'active' : ''}`}
          onClick={() => setActiveTab('productQr')}
        >
          <QrCode size={16} />
          <span>Product QR Scanner</span>
          <span className="tab-badge-pill">Camera & Image</span>
        </button>

        <button
          type="button"
          className={`scan-tab-btn ${activeTab === 'ocrBill' ? 'active' : ''}`}
          onClick={() => setActiveTab('ocrBill')}
        >
          <FileText size={16} />
          <span>Paper Receipt OCR</span>
          <span className="tab-badge-pill">Expense Slips</span>
        </button>

        <button
          type="button"
          className={`scan-tab-btn ${activeTab === 'qrHub' ? 'active' : ''}`}
          onClick={() => setActiveTab('qrHub')}
        >
          <Store size={16} />
          <span>Store QR Hub & Stickers</span>
          <span className="tab-badge-pill">{productsList.length} Items</span>
        </button>
      </div>

      {/* Success Notification Bar */}
      {saveSuccessMsg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#ecfdf5',
            border: '1.5px solid #10b981',
            borderRadius: '12px',
            padding: '12px 16px',
            color: '#065f46',
            fontSize: '13px',
            fontWeight: '600',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.1)',
            animation: 'fadeInPop 0.25s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} color="#10b981" />
            <span>{saveSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveSuccessMsg('')}
            style={{ background: 'none', border: 'none', color: '#059669', cursor: 'pointer', fontWeight: '800' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 1: PRODUCT QR SCANNER & LIVE POS BILLING                        */}
      {/* =================================================================== */}
      {activeTab === 'productQr' && (
        <div className="pos-scan-grid">
          {/* Left Column: Scanner & Product Card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Scanner Controller Card */}
            <div className="scanner-card">
              {/* Mode Switcher */}
              <div className="scanner-mode-switch">
                <button
                  type="button"
                  className={`scanner-mode-btn ${scannerMode === 'camera' ? 'active' : ''}`}
                  onClick={() => {
                    setScannerMode('camera');
                    setCameraError('');
                  }}
                >
                  <Camera size={15} />
                  <span>Live Camera Scanner</span>
                </button>

                <button
                  type="button"
                  className={`scanner-mode-btn ${scannerMode === 'upload' ? 'active' : ''}`}
                  onClick={() => {
                    setScannerMode('upload');
                    stopCameraScanner();
                  }}
                >
                  <Upload size={15} />
                  <span>Upload QR Image</span>
                </button>

                <button
                  type="button"
                  className={`scanner-mode-btn ${scannerMode === 'demo' ? 'active' : ''}`}
                  onClick={() => {
                    setScannerMode('demo');
                    stopCameraScanner();
                  }}
                >
                  <Zap size={15} />
                  <span>Quick Test QRs</span>
                </button>
              </div>

              {/* MODE A: LIVE CAMERA SCANNER */}
              {scannerMode === 'camera' && (
                <div>
                  <div
                    className="viewfinder-wrapper"
                    style={{
                      border: isDetectedBlink ? '3px solid #10b981' : '1px solid #e2e8f0',
                      boxShadow: isDetectedBlink ? '0 0 25px rgba(16, 185, 129, 0.45)' : undefined,
                      transition: 'all 0.2s ease',
                      position: 'relative',
                    }}
                  >
                    {/* Video mounting element */}
                    <div id="qr-reader" style={{ width: '100%', height: '100%' }} />

                    {/* Animated Laser Sweep & Reticle */}
                    {isCameraRunning && (
                      <>
                        <div className="scanner-laser-line" style={{ background: isDetectedBlink ? '#10b981' : undefined }} />
                        <div
                          className="scanner-reticle-corners"
                          style={{ borderColor: isDetectedBlink ? '#10b981' : undefined }}
                        />
                      </>
                    )}

                    {/* Camera Offline / Loading State */}
                    {!isCameraRunning && !cameraError && (
                      <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
                        <RefreshCw size={26} className="spin" style={{ margin: '0 auto 10px' }} />
                        <p style={{ margin: 0, fontSize: '13px', fontWeight: '600' }}>Initializing camera viewfinder...</p>
                      </div>
                    )}
                  </div>

                  {/* Camera Error Message with Helpful Fallback */}
                  {cameraError && (
                    <div style={{ backgroundColor: '#fff1f2', border: '1px solid #fda4af', borderRadius: '10px', padding: '12px', marginTop: '12px', color: '#9f1239', fontSize: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', marginBottom: '4px' }}>
                        <AlertTriangle size={15} />
                        <span>Camera Access Notice</span>
                      </div>
                      <p style={{ margin: 0 }}>{cameraError}</p>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setScannerMode('upload')}
                          style={{ backgroundColor: '#e11d48', color: '#fff', border: 'none', padding: '5px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                        >
                          Use Image Upload Instead
                        </button>
                        <button
                          type="button"
                          onClick={() => setScannerMode('demo')}
                          style={{ backgroundColor: '#ffffff', color: '#e11d48', border: '1px solid #fda4af', padding: '5px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                        >
                          Try Demo Items
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Camera Controls & Device Picker */}
                  {isCameraRunning && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginTop: '10px', fontSize: '12px', color: '#64748b' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 8px #10b981' }} />
                        <span style={{ fontWeight: '600', color: '#0f172a' }}>AI Scanner Active</span>
                        <span style={{ color: '#94a3b8' }}>• Continuous 10 FPS detection</span>
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {availableCameras.length > 1 && (
                          <select
                            value={selectedCameraId}
                            onChange={(e) => setSelectedCameraId(e.target.value)}
                            style={{
                              padding: '5px 8px',
                              borderRadius: '8px',
                              border: '1px solid #cbd5e1',
                              fontSize: '11px',
                              color: '#334155',
                              backgroundColor: '#ffffff',
                              cursor: 'pointer',
                            }}
                          >
                            <option value="">Default Camera</option>
                            {availableCameras.map((cam, idx) => (
                              <option key={cam.deviceId || idx} value={cam.deviceId}>
                                {cam.label || `Camera ${idx + 1}`}
                              </option>
                            ))}
                          </select>
                        )}

                        <button
                          type="button"
                          onClick={handleToggleFacingMode}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            padding: '5px 10px',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontWeight: '700',
                            color: '#334155',
                            cursor: 'pointer',
                          }}
                        >
                          <RotateCcw size={12} />
                          <span>Flip ({facingMode === 'environment' ? 'Back' : 'Front'})</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Pro-Tips for Scanning from Phone Screen */}
                  <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '10px 12px', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#166534' }}>
                      <Sparkles size={14} />
                      <span>Tips for 100% Instant Detection:</span>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '11px', color: '#15803d', lineHeight: '1.5' }}>
                      <li><strong>Scanning from another phone:</strong> Turn down phone screen brightness slightly to reduce white glare into webcam.</li>
                      <li><strong>Distance:</strong> Hold the phone <strong>20–30 cm</strong> away so the laptop camera focus stays sharp.</li>
                      <li><strong>Shortcut:</strong> You can also press <strong>Ctrl+V</strong> to paste a screenshot directly!</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* MODE B: UPLOAD QR IMAGE */}
              {scannerMode === 'upload' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <label
                    style={{
                      border: '2px dashed #38bdf8',
                      borderRadius: '14px',
                      backgroundColor: 'rgba(56, 189, 248, 0.04)',
                      padding: '24px 20px',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      transition: 'border-color 0.2s',
                    }}
                  >
                    <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: 'rgba(2, 132, 199, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                      <Upload size={22} />
                    </div>
                    <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                      {qrScanningFile ? 'Scanning Image for QR Code...' : 'Click or Drop Product QR Image'}
                    </strong>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      PNG, JPG, WEBP photos of product sticker, packaging or QR tag
                    </span>
                    <input type="file" accept="image/*" onChange={handleQrImageUpload} hidden disabled={qrScanningFile} />
                  </label>

                  {uploadedQrPreview && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <img
                        src={uploadedQrPreview}
                        alt="Uploaded QR preview"
                        style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b', display: 'block' }}>
                          Uploaded Image
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          {qrScanningFile ? 'Decodng...' : 'Decoded successfully! Check details below.'}
                        </span>
                      </div>
                    </div>
                  )}

                  {cameraError && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b91c1c', fontSize: '12px', backgroundColor: '#fef2f2', padding: '8px 12px', borderRadius: '8px' }}>
                      <XCircle size={15} style={{ flexShrink: 0 }} />
                      <span>{cameraError}</span>
                    </div>
                  )}

                  {/* Manual Code / Barcode Number Lookup Fallback */}
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>
                      Or type Barcode number / SKU manually:
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="e.g. 8901030384729, RICE-BAS-1KG, or 150"
                        value={manualCodeInput}
                        onChange={(e) => setManualCodeInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && manualCodeInput.trim()) {
                            processDecodedQrText(manualCodeInput.trim());
                            setManualCodeInput('');
                          }
                        }}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1.5px solid #cbd5e1',
                          fontSize: '12px',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (manualCodeInput.trim()) {
                            processDecodedQrText(manualCodeInput.trim());
                            setManualCodeInput('');
                          }
                        }}
                        style={{
                          padding: '8px 14px',
                          backgroundColor: '#0284c7',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '800',
                          cursor: 'pointer',
                        }}
                      >
                        Lookup Code
                      </button>
                    </div>
                  </div>
                </div>
              )}


              {/* MODE C: QUICK TEST DEMO ITEMS */}
              {scannerMode === 'demo' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>
                      Click any sample product to simulate scanning:
                    </span>
                    <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: '600' }}>
                      Offline Testing Ready
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
                    {demoItems.map((item) => (
                      <button
                        key={item.sku}
                        type="button"
                        onClick={() => handleSimulateDemoScan(item)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          border: '1px solid #e2e8f0',
                          backgroundColor: '#f8fafc',
                          textAlign: 'left',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#0284c7';
                          e.currentTarget.style.backgroundColor = '#f0f9ff';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#e2e8f0';
                          e.currentTarget.style.backgroundColor = '#f8fafc';
                        }}
                      >
                        <span style={{ fontSize: '20px' }}>{item.emoji}</span>
                        <div style={{ overflow: 'hidden' }}>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.name}
                          </span>
                          <span style={{ fontSize: '12px', fontWeight: '800', color: '#0284c7' }}>
                            ₹{item.price}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* DETECTED PRODUCT DETAILS CARD */}
            {detectedProduct && (
              <div className="product-detected-banner">
                {/* Header Tag & Stock Pill */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ backgroundColor: '#0284c7', color: '#ffffff', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '800' }}>
                      QR SCANNED
                    </span>
                    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                      SKU: {detectedProduct.sku || 'N/A'}
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      padding: '3px 10px',
                      borderRadius: '999px',
                      backgroundColor:
                        detectedProduct.stockQuantity === 0
                          ? 'rgba(239, 68, 68, 0.15)'
                          : 'rgba(16, 185, 129, 0.15)',
                      color: detectedProduct.stockQuantity === 0 ? '#b91c1c' : '#047857',
                      border: `1px solid ${
                        detectedProduct.stockQuantity === 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'
                      }`,
                    }}
                  >
                    {typeof detectedProduct.stockQuantity === 'number'
                      ? `Stock: ${detectedProduct.stockQuantity} available`
                      : detectedProduct.stockQuantity}
                  </span>
                </div>

                {/* Product Name & Editable Price */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: '0 0 2px' }}>
                      {detectedProduct.name}
                    </h3>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Category: {detectedProduct.category}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Unit Price:</span>
                    <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '8px', padding: '4px 8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>₹</span>
                      <input
                        type="number"
                        value={detectedProduct.price}
                        onChange={(e) =>
                          setDetectedProduct({ ...detectedProduct, price: Number(e.target.value) || 0 })
                        }
                        style={{
                          width: '75px',
                          border: 'none',
                          outline: 'none',
                          fontSize: '15px',
                          fontWeight: '800',
                          color: '#0f172a',
                          padding: '0 4px',
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Quantity Stepper & Calculated Total */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: '12px', padding: '10px 14px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>Quantity:</span>
                    <button
                      type="button"
                      className="qty-stepper-btn"
                      onClick={() => setScanQty((q) => Math.max(1, q - 1))}
                    >
                      <Minus size={14} />
                    </button>
                    <span style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', minWidth: '24px', textAlign: 'center' }}>
                      {scanQty}
                    </span>
                    <button
                      type="button"
                      className="qty-stepper-btn"
                      onClick={() => setScanQty((q) => q + 1)}
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Total Price to Add</span>
                    <strong style={{ fontSize: '18px', fontWeight: '800', color: '#059669' }}>
                      ₹{(Number(detectedProduct.price || 0) * scanQty).toLocaleString('en-IN')}
                    </strong>
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#334155' }}>Payment:</span>
                  {['Cash', 'GPay', 'PhonePe', 'UPI', 'Card'].map((pm) => (
                    <button
                      key={pm}
                      type="button"
                      onClick={() => setScanPaymentMethod(pm)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '700',
                        border: scanPaymentMethod === pm ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                        backgroundColor: scanPaymentMethod === pm ? '#e0f2fe' : '#ffffff',
                        color: scanPaymentMethod === pm ? '#0369a1' : '#475569',
                        cursor: 'pointer',
                      }}
                    >
                      {pm}
                    </button>
                  ))}
                </div>

                {/* Two Action Buttons: Instant Quick Sale OR Add to Customer Bill */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={handleInstantQuickSale}
                    disabled={saveLoading}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      backgroundColor: '#10b981',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      fontSize: '13px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                      transition: 'transform 0.1s',
                    }}
                  >
                    {saveLoading ? (
                      <RefreshCw size={16} className="spin" />
                    ) : (
                      <Zap size={16} />
                    )}
                    <span>⚡ Add ₹{(Number(detectedProduct.price || 0) * scanQty).toLocaleString('en-IN')} to Transactions</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleAddToCustomerBill}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      backgroundColor: '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      fontSize: '13px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
                    }}
                  >
                    <ShoppingCart size={16} />
                    <span>🛒 Add to Customer Bill</span>
                  </button>
                </div>

                <div style={{ textAlign: 'center', marginTop: '2px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setDetectedProduct(null);
                      lastScannedRef.current = { code: '', time: 0 };
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      fontSize: '11px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Discard / Scan Another Code
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Right Column: Active Customer Bill (Cart) */}
          <div className="active-bill-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(2, 132, 199, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                  <ShoppingCart size={16} />
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Active Customer Bill</h3>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>{customerBill.length} item(s) scanned</span>
                </div>
              </div>

              {customerBill.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCustomerBill([])}
                  style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Trash2 size={13} />
                  <span>Clear</span>
                </button>
              )}
            </div>

            {/* Bill Line Items */}
            {customerBill.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: '#94a3b8' }}>
                <Package size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: '13px', fontWeight: '600' }}>No items in current bill yet</p>
                <span style={{ fontSize: '11px' }}>Scan product QR codes on the left to add items to customer's receipt</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                {customerBill.map((item, idx) => (
                  <div
                    key={item.sku + idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      backgroundColor: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div style={{ overflow: 'hidden', paddingRight: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.name}
                      </span>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        ₹{item.unitPrice} each
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => handleUpdateBillQty(idx, -1)}
                        style={{ width: '22px', height: '22px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff', cursor: 'pointer', fontSize: '11px', fontWeight: '800' }}
                      >
                        -
                      </button>
                      <span style={{ fontSize: '12px', fontWeight: '800', minWidth: '18px', textAlign: 'center' }}>
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateBillQty(idx, 1)}
                        style={{ width: '22px', height: '22px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff', cursor: 'pointer', fontSize: '11px', fontWeight: '800' }}
                      >
                        +
                      </button>
                      <strong style={{ fontSize: '13px', color: '#0f172a', minWidth: '55px', textAlign: 'right' }}>
                        ₹{item.subtotal}
                      </strong>
                      <button
                        type="button"
                        onClick={() => handleRemoveBillItem(idx)}
                        style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px 4px' }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Bill Footer & Checkout Action */}
            {customerBill.length > 0 && (
              <div style={{ borderTop: '1.5px dashed #cbd5e1', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#475569' }}>Total Bill Amount:</span>
                  <strong style={{ fontSize: '20px', fontWeight: '800', color: '#059669' }}>
                    ₹{billTotalAmount.toLocaleString('en-IN')}
                  </strong>
                </div>

                <div>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '6px' }}>
                    Customer Payment Method:
                  </span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                    {['Cash', 'GPay', 'PhonePe', 'Card'].map((pm) => (
                      <button
                        key={pm}
                        type="button"
                        onClick={() => setBillPaymentMethod(pm)}
                        style={{
                          padding: '6px 4px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '700',
                          border: billPaymentMethod === pm ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                          backgroundColor: billPaymentMethod === pm ? '#e0f2fe' : '#ffffff',
                          color: billPaymentMethod === pm ? '#0369a1' : '#475569',
                          cursor: 'pointer',
                        }}
                      >
                        {pm}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCheckoutCustomerBill}
                  disabled={billSaving}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '12px',
                    fontSize: '14px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(15, 23, 42, 0.2)',
                  }}
                >
                  {billSaving ? (
                    <>
                      <RefreshCw size={16} className="spin" />
                      <span>Recording Bill...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} color="#34d399" />
                      <span>Complete Bill & Save to Ledger</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: LIVE CAMERA BILL SCANNER & REAL OCR RECEIPT INGESTION        */}
      {/* =================================================================== */}
      {activeTab === 'ocrBill' && (
        <div className="pos-scan-grid">
          <div className="scanner-card">
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(2, 132, 199, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                  <FileText size={16} />
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                    Live Camera Bill Scanner & Real OCR
                  </h3>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Live document viewfinder, Tesseract.js character recognition & ledger saving
                  </span>
                </div>
              </div>

              {/* Sub-Mode Switcher */}
              {!ocrData && !ocrPreview && (
                <div className="scanner-mode-switch" style={{ width: 'auto' }}>
                  <button
                    type="button"
                    className={`scanner-mode-btn ${billScannerMode === 'camera' ? 'active' : ''}`}
                    onClick={() => {
                      setBillScannerMode('camera');
                      setBillCameraError('');
                    }}
                  >
                    <Camera size={14} />
                    <span>Live Camera</span>
                  </button>

                  <button
                    type="button"
                    className={`scanner-mode-btn ${billScannerMode === 'upload' ? 'active' : ''}`}
                    onClick={() => {
                      setBillScannerMode('upload');
                      stopBillCamera();
                    }}
                  >
                    <Upload size={14} />
                    <span>Upload Image</span>
                  </button>
                </div>
              )}
            </div>

            {/* Error Notification */}
            {ocrError && (
              <div style={{ backgroundColor: '#fff1f2', border: '1px solid #fda4af', borderRadius: '10px', padding: '10px 14px', color: '#9f1239', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <XCircle size={16} style={{ flexShrink: 0 }} />
                <span>{ocrError}</span>
              </div>
            )}

            {/* STATE 1: LIVE CAMERA CAPTURE / UPLOAD SCREEN (when no image selected) */}
            {!ocrData && !ocrPreview && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* 1A: LIVE CAMERA SCANNER */}
                {billScannerMode === 'camera' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Live Camera Viewfinder with Document Alignment Guide */}
                    <div className="bill-viewfinder-container">
                      <video
                        ref={billVideoRef}
                        className="bill-video-stream"
                        autoPlay
                        playsInline
                        muted
                      />

                      {/* Document Alignment Frame */}
                      {isBillCameraRunning && (
                        <div className="document-guide-overlay">
                          <div className="document-guide-box">
                            <span className="guide-corner-tl" />
                            <span className="guide-corner-tr" />
                            <span className="guide-corner-bl" />
                            <span className="guide-corner-br" />
                            <span className="guide-center-scanner-line" />
                          </div>
                          <span style={{ marginTop: '10px', color: '#ffffff', fontSize: '11px', fontWeight: '700', textShadow: '0 1px 4px rgba(0,0,0,0.8)', backgroundColor: 'rgba(15, 23, 42, 0.75)', padding: '3px 10px', borderRadius: '999px' }}>
                            Align bill or receipt edges inside the blue frame
                          </span>
                        </div>
                      )}

                      {/* Loading or Inactive States */}
                      {isBillCameraStarting && (
                        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#38bdf8' }}>
                          <RefreshCw size={28} className="spin" />
                          <span style={{ fontSize: '13px', fontWeight: '700', color: '#fff' }}>Connecting to Camera...</span>
                        </div>
                      )}

                      {!isBillCameraRunning && !isBillCameraStarting && (
                        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#94a3b8', padding: '20px', textAlign: 'center' }}>
                          <CameraOff size={32} color="#64748b" />
                          <span style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: '700' }}>Camera is currently idle</span>
                          <button
                            type="button"
                            onClick={startBillCamera}
                            style={{ backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                          >
                            Start Camera
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Camera Action Buttons Bar */}
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={captureBillFrame}
                        disabled={!isBillCameraRunning || !billVideoReady}
                        style={{
                          flex: 1,
                          minWidth: '180px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          backgroundColor: isBillCameraRunning && billVideoReady ? '#0284c7' : '#94a3b8',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '10px',
                          padding: '12px 20px',
                          fontSize: '14px',
                          fontWeight: '800',
                          cursor: isBillCameraRunning && billVideoReady ? 'pointer' : 'not-allowed',
                          boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
                          transition: 'all 0.2s',
                        }}
                      >
                        <Camera size={18} />
                        <span>Capture Bill Photo</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setBillFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          backgroundColor: '#f1f5f9',
                          color: '#334155',
                          border: '1px solid #cbd5e1',
                          borderRadius: '10px',
                          padding: '12px 14px',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                        }}
                        title="Toggle front and rear camera lens"
                      >
                        <RotateCcw size={14} />
                        <span>Flip ({billFacingMode === 'environment' ? 'Rear' : 'Front'})</span>
                      </button>

                      {isBillCameraRunning ? (
                        <button
                          type="button"
                          onClick={stopBillCamera}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            backgroundColor: '#fef2f2',
                            color: '#b91c1c',
                            border: '1px solid #fecaca',
                            borderRadius: '10px',
                            padding: '12px 14px',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                          }}
                        >
                          <CameraOff size={14} />
                          <span>Stop</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={startBillCamera}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            backgroundColor: '#f0fdf4',
                            color: '#15803d',
                            border: '1px solid #bbf7d0',
                            borderRadius: '10px',
                            padding: '12px 14px',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                          }}
                        >
                          <Camera size={14} />
                          <span>Start</span>
                        </button>
                      )}
                    </div>

                    {/* Camera Error Message with Helpful Browser Instructions */}
                    {billCameraError && (
                      <div style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '12px', padding: '14px', color: '#9a3412', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', fontSize: '13px' }}>
                          <AlertTriangle size={16} color="#ea580c" />
                          <span>Camera Access Issue</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.5 }}>
                          {billCameraError}
                        </p>
                        <div style={{ fontSize: '11px', color: '#7c2d12', backgroundColor: 'rgba(255,255,255,0.7)', padding: '8px 10px', borderRadius: '8px' }}>
                          <strong>How to resolve:</strong>
                          <ul style={{ margin: '4px 0 0', paddingLeft: '18px' }}>
                            <li>Click the <strong>camera / padlock icon</strong> on the left side of your browser URL bar.</li>
                            <li>Change the Camera permission setting to <strong>"Allow"</strong>.</li>
                            <li>Or switch to <strong>Upload Image</strong> mode to pick any receipt photo from your files.</li>
                          </ul>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setBillScannerMode('upload');
                              setBillCameraError('');
                            }}
                            style={{ backgroundColor: '#ea580c', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                          >
                            Switch to Upload Image
                          </button>
                          <button
                            type="button"
                            onClick={startBillCamera}
                            style={{ backgroundColor: '#ffffff', color: '#9a3412', border: '1px solid #fdba74', borderRadius: '6px', padding: '6px 12px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                          >
                            Retry Camera
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 1B: FILE UPLOAD MODE */}
                {billScannerMode === 'upload' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <label
                      style={{
                        border: '2px dashed #0284c7',
                        borderRadius: '14px',
                        padding: '36px 20px',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '10px',
                        cursor: 'pointer',
                        backgroundColor: 'rgba(2, 132, 199, 0.03)',
                        transition: 'background-color 0.2s',
                      }}
                    >
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(2, 132, 199, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                        <Upload size={24} />
                      </div>
                      <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                        Click or drag & drop receipt / invoice image
                      </strong>
                      <span style={{ fontSize: '12px', color: '#64748b', maxWidth: '380px' }}>
                        Supports grocery tax invoices, electricity EB slips, wholesale trader bills, fuel receipts (PNG, JPG, WEBP)
                      </span>
                      <input type="file" accept="image/*" onChange={handleOcrFileSelect} hidden />
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* STATE 2: CAPTURED / SELECTED IMAGE PREVIEW & OCR PROCESSING */}
            {ocrPreview && !ocrData && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', backgroundColor: '#f8fafc', borderRadius: '14px', padding: '16px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', fontSize: '13px', color: '#1e293b' }}>
                    <FileText size={16} color="#0284c7" />
                    <span>Captured Bill Image</span>
                  </div>

                  {/* Preprocessing & Rotation Controls */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => rotateCapturedBill(90)}
                      disabled={ocrScanning}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '5px 10px',
                        fontSize: '11px',
                        fontWeight: '700',
                        color: '#334155',
                        cursor: 'pointer',
                      }}
                      title="Rotate image 90 degrees clockwise"
                    >
                      <RotateCw size={12} />
                      <span>Rotate 90°</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEnhanceContrast(!enhanceContrast)}
                      disabled={ocrScanning}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        backgroundColor: enhanceContrast ? '#e0f2fe' : '#ffffff',
                        border: enhanceContrast ? '1px solid #38bdf8' : '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '5px 10px',
                        fontSize: '11px',
                        fontWeight: '700',
                        color: enhanceContrast ? '#0284c7' : '#334155',
                        cursor: 'pointer',
                      }}
                      title="Optimize grayscale contrast for faded thermal receipts"
                    >
                      <SlidersHorizontal size={12} />
                      <span>{enhanceContrast ? 'Contrast: ON' : 'Contrast: OFF'}</span>
                    </button>
                  </div>
                </div>

                {/* Bill Image View */}
                <div style={{ display: 'flex', justifyContent: 'center', backgroundColor: '#020617', borderRadius: '10px', padding: '10px', maxHeight: '340px', overflow: 'hidden' }}>
                  <img
                    src={ocrPreview}
                    alt="Receipt preview"
                    style={{
                      maxHeight: '320px',
                      maxWidth: '100%',
                      objectFit: 'contain',
                      borderRadius: '6px',
                    }}
                  />
                </div>

                {/* Real-time OCR Progress Bar */}
                {ocrScanning && (
                  <div style={{ backgroundColor: '#ffffff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontWeight: '700', color: '#0369a1' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <RefreshCw size={14} className="spin" />
                        <span>{ocrStatusText || 'Recognizing receipt text with Tesseract.js...'}</span>
                      </div>
                      <span>{ocrProgress}%</span>
                    </div>

                    <div className="ocr-progress-track">
                      <div className="ocr-progress-fill" style={{ width: `${ocrProgress}%` }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                      <button
                        type="button"
                        onClick={handleCancelOcr}
                        style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                      >
                        Cancel OCR
                      </button>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                {!ocrScanning && (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={handleRunRealOcr}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        backgroundColor: '#0284c7',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '12px 20px',
                        fontSize: '13px',
                        fontWeight: '800',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
                      }}
                    >
                      <Sparkles size={16} />
                      <span>Process with Real OCR Vision</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setOcrFile(null);
                        setOcrPreview(null);
                        setCapturedBillUrl(null);
                        setOcrError('');
                        if (billScannerMode === 'camera') {
                          startBillCamera();
                        }
                      }}
                      style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '10px',
                        padding: '12px 16px',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: '#475569',
                        cursor: 'pointer',
                      }}
                    >
                      Retake / Retract
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* STATE 3: OCR EXTRACTION REVIEW & CONFIRMATION SCREEN */}
            {ocrData && (
              <div style={{ backgroundColor: '#ffffff', border: '1.5px solid #86efac', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 6px 20px rgba(16, 185, 129, 0.08)' }}>
                {/* Header with Real Tesseract Confidence */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', color: '#065f46', fontSize: '15px' }}>
                    <CheckCircle2 size={18} color="#10b981" />
                    <span>Receipt Parsed Successfully</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', backgroundColor: '#dcfce7', color: '#166534', padding: '3px 10px', borderRadius: '999px', fontWeight: '700' }}>
                      {ocrData.confidence > 0 ? `Text Confidence: ${ocrData.confidence}%` : 'Extracted via OCR'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setOcrData(null);
                        setOcrPreview(null);
                        setCapturedBillUrl(null);
                        setOcrFile(null);
                        setOcrRawText('');
                        setOcrShowConfirm(false);
                        if (billScannerMode === 'camera') startBillCamera();
                      }}
                      style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '12px', cursor: 'pointer', fontWeight: '700' }}
                    >
                      ✕ Discard
                    </button>
                  </div>
                </div>

                {/* Mathematical Validation Note Alert */}
                {ocrData.validationNotes && ocrData.validationNotes.length > 0 && (
                  <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '8px 12px', color: '#166534', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={14} color="#16a34a" style={{ flexShrink: 0 }} />
                    <span>{ocrData.validationNotes.join(' ')}</span>
                  </div>
                )}

                {/* Duplicate Bill Warning */}
                {ocrDuplicateWarning && (
                  <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: '8px', padding: '10px 12px', color: '#92400e', fontSize: '12px', display: 'flex', gap: '8px' }}>
                    <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>{ocrDuplicateWarning}</span>
                  </div>
                )}

                {/* Type Selector (Expense vs Sale) */}
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '4px' }}>
                    Transaction Flow Type:
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setOcrData({ ...ocrData, type: 'Expense' })}
                      style={{
                        padding: '8px',
                        borderRadius: '8px',
                        border: ocrData.type === 'Expense' ? '2px solid #ef4444' : '1px solid #cbd5e1',
                        backgroundColor: ocrData.type === 'Expense' ? '#fef2f2' : '#ffffff',
                        color: ocrData.type === 'Expense' ? '#b91c1c' : '#475569',
                        fontSize: '12px',
                        fontWeight: '800',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <Minus size={14} />
                      <span>Expense (Outflow / Purchase)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOcrData({ ...ocrData, type: 'Sale' })}
                      style={{
                        padding: '8px',
                        borderRadius: '8px',
                        border: ocrData.type === 'Sale' ? '2px solid #10b981' : '1px solid #cbd5e1',
                        backgroundColor: ocrData.type === 'Sale' ? '#ecfdf5' : '#ffffff',
                        color: ocrData.type === 'Sale' ? '#047857' : '#475569',
                        fontSize: '12px',
                        fontWeight: '800',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <Plus size={14} />
                      <span>Sale (Inflow / Customer Receipt)</span>
                    </button>
                  </div>
                </div>

                {/* Editable Fields Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  {/* Merchant / Vendor */}
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '3px' }}>
                      {ocrData.type === 'Sale' ? 'Customer / Sold To' : 'Merchant / Vendor / Supplier'}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Sri Meenakshi Traders"
                      value={ocrData.merchant || ''}
                      onChange={(e) => {
                        const updated = { ...ocrData, merchant: e.target.value };
                        setOcrData(updated);
                        if (updated.amount) checkDuplicateBill(updated.amount, e.target.value);
                      }}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>

                  {/* Bill Date */}
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '3px' }}>
                      Bill / Invoice Date
                    </label>
                    <input
                      type="date"
                      value={ocrData.billDate || ''}
                      onChange={(e) => setOcrData({ ...ocrData, billDate: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>

                  {/* Invoice / Reference Number */}
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '3px' }}>
                      Invoice / Bill #
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. INV-2024-904"
                      value={ocrData.invoiceNumber || ''}
                      onChange={(e) => setOcrData({ ...ocrData, invoiceNumber: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>

                  {/* Total Amount */}
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '700', color: '#047857', display: 'block', marginBottom: '3px' }}>
                      Total Amount (₹) *
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="0.00"
                      value={ocrData.amount || ''}
                      onChange={(e) => {
                        const updated = { ...ocrData, amount: e.target.value };
                        setOcrData(updated);
                        if (e.target.value) checkDuplicateBill(e.target.value, updated.merchant);
                      }}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '2px solid #10b981', fontSize: '15px', fontWeight: '800', color: '#065f46' }}
                    />
                  </div>

                  {/* Category or Payment Method depending on type */}
                  {ocrData.type === 'Expense' ? (
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '3px' }}>
                        Expense Category
                      </label>
                      <select
                        value={ocrData.category || 'Stock'}
                        onChange={(e) => setOcrData({ ...ocrData, category: e.target.value })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                      >
                        <option value="Stock">Stock (Inventory Purchase)</option>
                        <option value="Rent">Shop Rent</option>
                        <option value="Electricity">Electricity / Power</option>
                        <option value="Salary">Staff Salary</option>
                        <option value="Transport">Transport / Logistics</option>
                        <option value="Other">Other Expenses</option>
                      </select>
                    </div>
                  ) : null}

                  {/* Payment Method */}
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '3px' }}>
                      Payment Method
                    </label>
                    <select
                      value={ocrData.paymentMethod || 'Cash'}
                      onChange={(e) => setOcrData({ ...ocrData, paymentMethod: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                    >
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI (GPay / PhonePe / QR)</option>
                      {ocrData.type === 'Sale' && <option value="GPay">Google Pay (GPay)</option>}
                      {ocrData.type === 'Sale' && <option value="PhonePe">PhonePe</option>}
                      <option value="Card">Card (Debit / Credit)</option>
                    </select>
                  </div>
                </div>

                {/* Subtotal, Tax, Discount breakdown (if detected) */}
                {(ocrData.subtotal || ocrData.tax || ocrData.discount) && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', backgroundColor: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div>
                      <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>Subtotal (Taxable)</span>
                      <strong style={{ fontSize: '12px', color: '#334155' }}>
                        ₹{ocrData.subtotal || '0.00'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>Tax / GST</span>
                      <strong style={{ fontSize: '12px', color: '#334155' }}>
                        ₹{ocrData.tax || '0.00'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', color: '#64748b', display: 'block' }}>Discount</span>
                      <strong style={{ fontSize: '12px', color: '#334155' }}>
                        ₹{ocrData.discount || '0.00'}
                      </strong>
                    </div>
                  </div>
                )}

                {/* Line Items Table (if any were recognized) */}
                {Array.isArray(ocrData.items) && ocrData.items.length > 0 && (
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>
                      Identified Line Items ({ocrData.items.length}):
                    </span>
                    <div style={{ maxHeight: '140px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8fafc', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                            <th style={{ padding: '6px 10px' }}>Description</th>
                            <th style={{ padding: '6px 10px' }}>Qty</th>
                            <th style={{ padding: '6px 10px' }}>Rate</th>
                            <th style={{ padding: '6px 10px' }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ocrData.items.map((it, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '6px 10px', fontWeight: '600' }}>{it.name}</td>
                              <td style={{ padding: '6px 10px' }}>{it.quantity}</td>
                              <td style={{ padding: '6px 10px' }}>₹{it.unitPrice}</td>
                              <td style={{ padding: '6px 10px', fontWeight: '700' }}>₹{it.total}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Raw OCR Text Accordion (Debugging and Transparency) */}
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setShowRawText(!showRawText)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#0284c7',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: 0,
                      }}
                    >
                      {showRawText ? <EyeOff size={12} /> : <Eye size={12} />}
                      <span>{showRawText ? 'Hide Raw OCR Text' : 'Inspect Raw OCR Recognized Text'}</span>
                    </button>

                    {showRawText && (
                      <button
                        type="button"
                        onClick={() => {
                          if (ocrRawText) {
                            navigator.clipboard.writeText(ocrRawText);
                            setCopiedRawText(true);
                            setTimeout(() => setCopiedRawText(false), 2000);
                          }
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: copiedRawText ? '#10b981' : '#64748b',
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Copy size={12} />
                        <span>{copiedRawText ? 'Copied!' : 'Copy Text'}</span>
                      </button>
                    )}
                  </div>

                  {showRawText && (
                    <div style={{ marginTop: '8px', maxHeight: '160px', overflowY: 'auto', backgroundColor: '#0f172a', borderRadius: '8px', padding: '10px', color: '#38bdf8', fontSize: '11px', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                      {ocrRawText || 'No raw text stored.'}
                    </div>
                  )}
                </div>

                {/* Save Confirmation Dialog / Action Button */}
                {ocrShowConfirm ? (
                  <div style={{ backgroundColor: '#f0fdf4', borderRadius: '10px', padding: '14px', border: '1.5px solid #86efac', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: '800', color: '#065f46' }}>
                      Record ₹{ocrData.amount} as a {ocrData.type} for "{ocrData.merchant || 'Unknown'}" on {ocrData.billDate}?
                    </p>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button
                        type="button"
                        onClick={handleSaveOcrTransaction}
                        disabled={ocrSaving}
                        style={{
                          backgroundColor: '#10b981',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '10px 20px',
                          fontSize: '13px',
                          fontWeight: '800',
                          cursor: ocrSaving ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        {ocrSaving ? <RefreshCw size={14} className="spin" /> : <CheckCircle2 size={16} />}
                        <span>{ocrSaving ? 'Recording to Ledger...' : 'Confirm & Save Transaction'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setOcrShowConfirm(false)}
                        disabled={ocrSaving}
                        style={{
                          backgroundColor: '#f1f5f9',
                          color: '#475569',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          padding: '10px 14px',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        Back to Edit
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!ocrData.amount || Number(ocrData.amount) <= 0) {
                          setOcrError('Please enter a valid total amount before saving.');
                          return;
                        }
                        setOcrShowConfirm(true);
                      }}
                      style={{
                        flex: 1,
                        backgroundColor: '#10b981',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '12px',
                        fontSize: '13px',
                        fontWeight: '800',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                      }}
                    >
                      <CheckCircle2 size={16} />
                      <span>Review & Save Bill to Ledger</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setOcrData(null);
                        setOcrPreview(null);
                        setCapturedBillUrl(null);
                        setOcrFile(null);
                        setOcrRawText('');
                        setOcrShowConfirm(false);
                        if (billScannerMode === 'camera') startBillCamera();
                      }}
                      style={{
                        backgroundColor: '#f1f5f9',
                        color: '#64748b',
                        border: '1px solid #cbd5e1',
                        borderRadius: '10px',
                        padding: '12px 16px',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer',
                      }}
                    >
                      Scan Another
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Info Sidebar */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                <Sparkles size={16} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>Real OCR Vision Ingestion</h4>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Client-Side Computer Vision</span>
              </div>
            </div>

            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#475569', lineHeight: 1.7 }}>
              <li><strong>Live Camera Capture:</strong> Targets bills with alignment frame overlay & rear camera lens selection.</li>
              <li><strong>Real OCR Engine:</strong> Client-side Tesseract.js recognizes printed characters directly in browser.</li>
              <li><strong>Smart Field Extraction:</strong> Extracts merchant, invoice #, bill date, subtotal, tax, and grand total.</li>
              <li><strong>Duplicate Detection:</strong> Alerts if an invoice with matching amount was previously recorded.</li>
              <li><strong>Financial Ledger Sync:</strong> Saves directly into your MongoDB sales or expense transactions.</li>
            </ul>

            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <strong style={{ fontSize: '11px', color: '#166534' }}>💡 Scanning Tips for Crisp OCR:</strong>
              <span style={{ fontSize: '11px', color: '#15803d', lineHeight: 1.5 }}>
                • Flatten thermal receipts before shooting.<br />
                • Keep camera steady at 15–25 cm distance.<br />
                • Toggle "Contrast: ON" for faint printouts.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: PRODUCT QR GENERATOR & INVENTORY HUB                         */}
      {/* =================================================================== */}
      {activeTab === 'qrHub' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Action & Filter Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', backgroundColor: '#ffffff', padding: '14px 18px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
            <input
              type="text"
              placeholder="Search products by name or SKU..."
              value={searchProductQuery}
              onChange={(e) => setSearchProductQuery(e.target.value)}
              style={{ width: '280px', padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '13px' }}
            />

            <div style={{ display: 'flex', gap: '10px' }}>
              {productsList.length === 0 && (
                <button
                  type="button"
                  onClick={handleSeedCatalog}
                  disabled={seedingLoading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  <Zap size={14} />
                  <span>{seedingLoading ? 'Seeding...' : '⚡ Seed 5 Demo Products with QRs'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowAddProductModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '12px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(16, 185, 129, 0.2)',
                }}
              >
                <Plus size={15} />
                <span>+ Add Product with QR</span>
              </button>
            </div>
          </div>

          {/* Printable Sticker Modal / Preview */}
          {printingProduct && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                backdropFilter: 'blur(4px)',
              }}
            >
              <div
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '16px',
                  padding: '24px',
                  width: '320px',
                  textAlign: 'center',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div style={{ border: '2px solid #0f172a', borderRadius: '12px', padding: '16px', width: '100%', backgroundColor: '#f8fafc' }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '1px', textTransform: 'uppercase', color: '#0284c7', display: 'block', marginBottom: '4px' }}>
                    SMART BUSINESS STORE
                  </span>
                  <h4 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                    {printingProduct.name}
                  </h4>
                  <div style={{ display: 'inline-block', backgroundColor: '#ffffff', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', margin: '6px 0' }}>
                    <QRCodeSVG
                      value={JSON.stringify({
                        id: printingProduct._id,
                        sku: printingProduct.sku,
                        name: printingProduct.name,
                        price: printingProduct.price,
                      })}
                      size={120}
                    />
                  </div>
                  <strong style={{ display: 'block', fontSize: '20px', fontWeight: '900', color: '#059669', margin: '4px 0 2px' }}>
                    ₹{printingProduct.price}
                  </strong>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>
                    SKU: {printingProduct.sku || 'N/A'}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    style={{ flex: 1, backgroundColor: '#0f172a', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <Printer size={15} />
                    <span>Print Sticker</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintingProduct(null)}
                    style={{ backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Add Product Modal */}
          {showAddProductModal && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                backdropFilter: 'blur(4px)',
              }}
            >
              <form
                onSubmit={handleCreateNewProduct}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '16px',
                  padding: '24px',
                  width: '420px',
                  maxWidth: '90%',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                    Add Product & Generate QR Code
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowAddProductModal(false)}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '16px', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>Product Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Aashirvaad Atta 5kg"
                    value={newProdData.name}
                    onChange={(e) => setNewProdData({ ...newProdData, name: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>SKU / Barcode</label>
                    <input
                      type="text"
                      placeholder="e.g. ATTA-5KG"
                      value={newProdData.sku}
                      onChange={(e) => setNewProdData({ ...newProdData, sku: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>Selling Price (₹) *</label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 260"
                      value={newProdData.price}
                      onChange={(e) => setNewProdData({ ...newProdData, price: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>Purchase Cost (₹)</label>
                    <input
                      type="number"
                      placeholder="e.g. 220"
                      value={newProdData.costPrice}
                      onChange={(e) => setNewProdData({ ...newProdData, costPrice: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>Initial Stock</label>
                    <input
                      type="number"
                      placeholder="e.g. 25"
                      value={newProdData.stockQuantity}
                      onChange={(e) => setNewProdData({ ...newProdData, stockQuantity: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button
                    type="submit"
                    disabled={creatingProduct}
                    style={{ flex: 1, backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: '800', cursor: 'pointer' }}
                  >
                    {creatingProduct ? 'Creating...' : 'Save & Generate QR'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddProductModal(false)}
                    style={{ backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Product QR Grid */}
          {loadingProducts ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
              <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px' }} />
              <p style={{ margin: 0, fontSize: '13px' }}>Loading products catalog...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '40px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
              <Package size={36} color="#94a3b8" style={{ margin: '0 auto 10px' }} />
              <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                No Products Found
              </h3>
              <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748b' }}>
                Click "+ Add Product with QR" to add your first product or seed sample catalog items.
              </p>
              <button
                type="button"
                onClick={handleSeedCatalog}
                disabled={seedingLoading}
                style={{
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  fontSize: '13px',
                  fontWeight: '800',
                  cursor: 'pointer',
                }}
              >
                {seedingLoading ? 'Populating...' : 'Seed 5 Demo Items Now'}
              </button>
            </div>
          ) : (
            <div className="qr-products-grid">
              {filteredProducts.map((p) => {
                const qrPayload = JSON.stringify({
                  id: p._id,
                  sku: p.sku,
                  name: p.name,
                  price: p.price,
                });

                return (
                  <div key={p._id} className="qr-product-card">
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
                      {p.category || 'General'}
                    </span>

                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#0f172a', minHeight: '36px', display: 'flex', alignItems: 'center' }}>
                      {p.name}
                    </h4>

                    {/* Scannable QR Code Box */}
                    <div className="qr-sticker-box">
                      <QRCodeSVG value={qrPayload} size={105} />
                      <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '700' }}>
                        {p.sku || p._id.slice(-6)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginTop: '2px' }}>
                      <strong style={{ fontSize: '16px', fontWeight: '900', color: '#059669' }}>
                        ₹{p.price}
                      </strong>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          color: p.stockQuantity <= 5 ? '#b91c1c' : '#475569',
                          backgroundColor: p.stockQuantity <= 5 ? '#fef2f2' : '#f1f5f9',
                          padding: '2px 8px',
                          borderRadius: '999px',
                        }}
                      >
                        {p.stockQuantity} in stock
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', width: '100%', marginTop: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setPrintingProduct(p)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          padding: '6px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: '#ffffff',
                          fontSize: '11px',
                          fontWeight: '700',
                          color: '#334155',
                          cursor: 'pointer',
                        }}
                      >
                        <Printer size={12} />
                        <span>Print Sticker</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('productQr');
                          processDecodedQrText(qrPayload);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px',
                          padding: '6px',
                          borderRadius: '6px',
                          border: 'none',
                          backgroundColor: '#0284c7',
                          color: '#ffffff',
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: 'pointer',
                        }}
                      >
                        <Scan size={12} />
                        <span>Test Scan</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ScanBill;
