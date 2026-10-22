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
  // TAB 2: REAL OCR BILL SCANNER STATE (UPLOAD ONLY)
  // ==========================================
  const ocrWorkerRef = useRef(null);

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

  // Global Clipboard Paste Support (Ctrl+V image directly to scan or OCR!)
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      if (activeTab === 'productQr') {
        for (const item of items) {
          if (item.type && item.type.startsWith('image/')) {
            const blob = item.getAsFile();
            if (blob) {
              handleQrImageUpload(blob);
              break;
            }
          }
        }
      } else if (activeTab === 'ocrBill') {
        for (const item of items) {
          if (item.type && item.type.startsWith('image/')) {
            const blob = item.getAsFile();
            if (blob) {
              handleOcrFileSelect({ target: { files: [blob] } });
              break;
            }
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
  // TAB 2: REAL OCR BILL INGESTION (IMAGE UPLOAD)
  // ==========================================

  // Clean up OCR worker on unmount
  useEffect(() => {
    return () => {
      if (ocrWorkerRef.current) {
        ocrWorkerRef.current.terminate().catch(() => {});
        ocrWorkerRef.current = null;
      }
    };
  }, []);

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
          <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Scan size={22} color="#38bdf8" />
            <span>Product QR Scanner & Billing Station</span>
          </h2>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '3px 0 0' }}>
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
            backgroundColor: 'rgba(13, 24, 46, 0.75)',
            border: '1px solid rgba(59, 130, 246, 0.35)',
            borderRadius: '999px',
            padding: '7px 16px',
            fontSize: '12px',
            fontWeight: '700',
            color: '#38bdf8',
            cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
            transition: 'all 0.15s ease',
          }}
        >
          <ReceiptText size={14} color="#38bdf8" />
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
          <span className="tab-badge-pill">Image Upload</span>
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
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginTop: '10px', fontSize: '12px', color: '#94a3b8' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 8px #10b981' }} />
                        <span style={{ fontWeight: '600', color: '#ffffff' }}>AI Scanner Active</span>
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
                              border: '1px solid rgba(59, 130, 246, 0.35)',
                              fontSize: '11px',
                              color: '#ffffff',
                              backgroundColor: 'rgba(16, 28, 52, 0.75)',
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
                            background: 'rgba(255, 255, 255, 0.08)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            padding: '5px 10px',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontWeight: '700',
                            color: '#e2e8f0',
                            cursor: 'pointer',
                          }}
                        >
                          <RotateCcw size={12} />
                          <span>Flip ({facingMode === 'environment' ? 'Back' : 'Front'})</span>
                        </button>
                      </div>
                    </div>
                  )}
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
                    <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
                      <Upload size={22} />
                    </div>
                    <strong style={{ fontSize: '14px', color: '#ffffff' }}>
                      {qrScanningFile ? 'Scanning Image for QR Code...' : 'Click or Drop Product QR Image'}
                    </strong>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                      PNG, JPG, WEBP photos of product sticker, packaging or QR tag
                    </span>
                    <input type="file" accept="image/*" onChange={handleQrImageUpload} hidden disabled={qrScanningFile} />
                  </label>

                  {uploadedQrPreview && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '10px', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                      <img
                        src={uploadedQrPreview}
                        alt="Uploaded QR preview"
                        style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px', border: '1px solid rgba(59, 130, 246, 0.3)' }}
                      />
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: '#ffffff', display: 'block' }}>
                          Uploaded Image
                        </span>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                          {qrScanningFile ? 'Decoding...' : 'Decoded successfully! Check details below.'}
                        </span>
                      </div>
                    </div>
                  )}

                  {cameraError && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171', fontSize: '12px', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '8px 12px', borderRadius: '8px' }}>
                      <XCircle size={15} style={{ flexShrink: 0 }} />
                      <span>{cameraError}</span>
                    </div>
                  )}

                  {/* Manual Code / Barcode Number Lookup Fallback */}
                  <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8' }}>
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
                          border: '1px solid rgba(59, 130, 246, 0.35)',
                          backgroundColor: 'rgba(16, 28, 52, 0.65)',
                          color: '#ffffff',
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
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#94a3b8' }}>
                      Click any sample product to simulate scanning:
                    </span>
                    <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: '600' }}>
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
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          backgroundColor: 'rgba(255, 255, 255, 0.04)',
                          textAlign: 'left',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.4)';
                          e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.12)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                        }}
                      >
                        <span style={{ fontSize: '20px' }}>{item.emoji}</span>
                        <div style={{ overflow: 'hidden' }}>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#ffffff', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.name}
                          </span>
                          <span style={{ fontSize: '12px', fontWeight: '800', color: '#38bdf8' }}>
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
                    <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#ffffff', margin: '0 0 2px' }}>
                      {detectedProduct.name}
                    </h3>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>Category: {detectedProduct.category}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Unit Price:</span>
                    <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'rgba(16, 28, 52, 0.75)', border: '1px solid rgba(59, 130, 246, 0.4)', borderRadius: '8px', padding: '4px 8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '800', color: '#38bdf8' }}>₹</span>
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
                          color: '#ffffff',
                          backgroundColor: 'transparent',
                          padding: '0 4px',
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Quantity Stepper & Calculated Total */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(13, 24, 46, 0.75)', borderRadius: '12px', padding: '10px 14px', border: '1px solid rgba(59, 130, 246, 0.22)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#cbd5e1' }}>Quantity:</span>
                    <button
                      type="button"
                      className="qty-stepper-btn"
                      onClick={() => setScanQty((q) => Math.max(1, q - 1))}
                    >
                      <Minus size={14} />
                    </button>
                    <span style={{ fontSize: '15px', fontWeight: '800', color: '#ffffff', minWidth: '24px', textAlign: 'center' }}>
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
                    <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>Total Price to Add</span>
                    <strong style={{ fontSize: '18px', fontWeight: '800', color: '#34d399' }}>
                      ₹{(Number(detectedProduct.price || 0) * scanQty).toLocaleString('en-IN')}
                    </strong>
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#cbd5e1' }}>Payment:</span>
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
                        border: scanPaymentMethod === pm ? '1.5px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.12)',
                        backgroundColor: scanPaymentMethod === pm ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        color: scanPaymentMethod === pm ? '#38bdf8' : '#94a3b8',
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
                      color: '#94a3b8',
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
                  <ShoppingCart size={16} />
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#ffffff', margin: 0 }}>Active Customer Bill</h3>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>{customerBill.length} item(s) scanned</span>
                </div>
              </div>

              {customerBill.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCustomerBill([])}
                  style={{ background: 'none', border: 'none', color: '#f87171', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
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
                <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#cbd5e1' }}>No items in current bill yet</p>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>Scan product QR codes on the left to add items to customer's receipt</span>
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
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <div style={{ overflow: 'hidden', paddingRight: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#ffffff', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.name}
                      </span>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                        ₹{item.unitPrice} each
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => handleUpdateBillQty(idx, -1)}
                        style={{ width: '22px', height: '22px', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.08)', color: '#ffffff', cursor: 'pointer', fontSize: '11px', fontWeight: '800' }}
                      >
                        -
                      </button>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#ffffff', minWidth: '18px', textAlign: 'center' }}>
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateBillQty(idx, 1)}
                        style={{ width: '22px', height: '22px', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.08)', color: '#ffffff', cursor: 'pointer', fontSize: '11px', fontWeight: '800' }}
                      >
                        +
                      </button>
                      <strong style={{ fontSize: '13px', color: '#38bdf8', minWidth: '55px', textAlign: 'right' }}>
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
              <div style={{ borderTop: '1px dashed rgba(255, 255, 255, 0.15)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#94a3b8' }}>Total Bill Amount:</span>
                  <strong style={{ fontSize: '20px', fontWeight: '800', color: '#34d399' }}>
                    ₹{billTotalAmount.toLocaleString('en-IN')}
                  </strong>
                </div>

                <div>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
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
                          border: billPaymentMethod === pm ? '1.5px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.12)',
                          backgroundColor: billPaymentMethod === pm ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                          color: billPaymentMethod === pm ? '#38bdf8' : '#94a3b8',
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
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '12px',
                    fontSize: '14px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
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
      {/* TAB 2: RECEIPT / BILL OCR INGESTION (IMAGE UPLOAD ONLY)              */}
      {/* =================================================================== */}
      {activeTab === 'ocrBill' && (
        <div style={{ maxWidth: '820px', margin: '0 auto', width: '100%' }}>
          <div className="scanner-card">
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
                  <FileText size={16} />
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#ffffff', margin: 0 }}>
                    Paper Receipt & Bill OCR
                  </h3>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Upload receipt or invoice image for automated character recognition & ledger saving
                  </span>
                </div>
              </div>
            </div>

            {/* Error Notification */}
            {ocrError && (
              <div style={{ backgroundColor: '#fff1f2', border: '1px solid #fda4af', borderRadius: '10px', padding: '10px 14px', color: '#9f1239', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
                <XCircle size={16} style={{ flexShrink: 0 }} />
                <span>{ocrError}</span>
              </div>
            )}

            {/* STATE 1: UPLOAD SCREEN (when no image selected) */}
            {!ocrData && !ocrPreview && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '14px' }}>
                <label
                  style={{
                    border: '2px dashed #0284c7',
                    borderRadius: '16px',
                    padding: '48px 24px',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '14px',
                    cursor: 'pointer',
                    backgroundColor: 'rgba(2, 132, 199, 0.04)',
                    transition: 'all 0.2s ease',
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleOcrFileSelect({ target: { files: e.dataTransfer.files } });
                    }
                  }}
                >
                  <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
                    <Upload size={30} />
                  </div>
                  <div>
                    <strong style={{ fontSize: '16px', color: '#ffffff', display: 'block', marginBottom: '6px' }}>
                      Click or drag & drop receipt / invoice image
                    </strong>
                    <span style={{ fontSize: '13px', color: '#94a3b8', maxWidth: '440px', display: 'block', margin: '0 auto', lineHeight: 1.5 }}>
                      Supports grocery tax invoices, electricity EB slips, wholesale trader bills, fuel receipts (PNG, JPG, WEBP)
                    </span>
                  </div>

                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: '#0284c7', color: '#ffffff', padding: '8px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: '800', marginTop: '6px', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)' }}>
                    <Upload size={15} />
                    <span>Browse Bill Image</span>
                  </div>

                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Or paste screenshot directly with <kbd style={{ padding: '2px 5px', borderRadius: '4px', background: 'rgba(255,255,255,0.08)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.15)' }}>Ctrl+V</kbd>
                  </span>

                  <input type="file" accept="image/*" onChange={handleOcrFileSelect} hidden />
                </label>
              </div>
            )}

            {/* STATE 2: CAPTURED / SELECTED IMAGE PREVIEW & OCR PROCESSING */}
            {ocrPreview && !ocrData && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', backgroundColor: 'rgba(16, 29, 54, 0.75)', borderRadius: '14px', padding: '16px', border: '1px solid rgba(59, 130, 246, 0.22)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', fontSize: '13px', color: '#ffffff' }}>
                    <FileText size={16} color="#38bdf8" />
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
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '6px',
                        padding: '5px 10px',
                        fontSize: '11px',
                        fontWeight: '700',
                        color: '#e2e8f0',
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
                        backgroundColor: enhanceContrast ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                        border: enhanceContrast ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '6px',
                        padding: '5px 10px',
                        fontSize: '11px',
                        fontWeight: '700',
                        color: enhanceContrast ? '#38bdf8' : '#e2e8f0',
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
                      }}
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '10px',
                        padding: '12px 16px',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: '#e2e8f0',
                        cursor: 'pointer',
                      }}
                    >
                      Choose Different Image
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* STATE 3: OCR EXTRACTION REVIEW & CONFIRMATION SCREEN */}
            {ocrData && (
              <div style={{ backgroundColor: 'rgba(16, 29, 54, 0.85)', border: '1.5px solid rgba(16, 185, 129, 0.4)', borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 8px 30px rgba(0, 0, 0, 0.35)' }}>
                {/* Header with Real Tesseract Confidence */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', color: '#34d399', fontSize: '15px' }}>
                    <CheckCircle2 size={18} color="#10b981" />
                    <span>Receipt Parsed Successfully</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '3px 10px', borderRadius: '999px', fontWeight: '700', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
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
                      }}
                      style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '12px', cursor: 'pointer', fontWeight: '700' }}
                    >
                      ✕ Discard
                    </button>
                  </div>
                </div>

                {/* Mathematical Validation Note Alert */}
                {ocrData.validationNotes && ocrData.validationNotes.length > 0 && (
                  <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', padding: '8px 12px', color: '#34d399', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={14} color="#34d399" style={{ flexShrink: 0 }} />
                    <span>{ocrData.validationNotes.join(' ')}</span>
                  </div>
                )}

                {/* Duplicate Bill Warning */}
                {ocrDuplicateWarning && (
                  <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: '8px', padding: '10px 12px', color: '#fcd34d', fontSize: '12px', display: 'flex', gap: '8px' }}>
                    <AlertTriangle size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>{ocrDuplicateWarning}</span>
                  </div>
                )}

                {/* Type Selector (Expense vs Sale) */}
                <div>
                  <label style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                    Transaction Flow Type:
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setOcrData({ ...ocrData, type: 'Expense' })}
                      style={{
                        padding: '8px',
                        borderRadius: '8px',
                        border: ocrData.type === 'Expense' ? '2px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.1)',
                        backgroundColor: ocrData.type === 'Expense' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        color: ocrData.type === 'Expense' ? '#f87171' : '#94a3b8',
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
                        border: ocrData.type === 'Sale' ? '2px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)',
                        backgroundColor: ocrData.type === 'Sale' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        color: ocrData.type === 'Sale' ? '#34d399' : '#94a3b8',
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
                    <label style={{ fontSize: '11px', fontWeight: '700', color: '#cbd5e1', display: 'block', marginBottom: '3px' }}>
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
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.35)', backgroundColor: 'rgba(16, 28, 52, 0.75)', color: '#ffffff', fontSize: '13px' }}
                    />
                  </div>

                  {/* Bill Date */}
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '700', color: '#cbd5e1', display: 'block', marginBottom: '3px' }}>
                      Bill / Invoice Date
                    </label>
                    <input
                      type="date"
                      value={ocrData.billDate || ''}
                      onChange={(e) => setOcrData({ ...ocrData, billDate: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.35)', backgroundColor: 'rgba(16, 28, 52, 0.75)', color: '#ffffff', fontSize: '13px' }}
                    />
                  </div>

                  {/* Invoice / Reference Number */}
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '700', color: '#cbd5e1', display: 'block', marginBottom: '3px' }}>
                      Invoice / Bill #
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. INV-2024-904"
                      value={ocrData.invoiceNumber || ''}
                      onChange={(e) => setOcrData({ ...ocrData, invoiceNumber: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.35)', backgroundColor: 'rgba(16, 28, 52, 0.75)', color: '#ffffff', fontSize: '13px' }}
                    />
                  </div>

                  {/* Total Amount */}
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '700', color: '#34d399', display: 'block', marginBottom: '3px' }}>
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
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '2px solid #10b981', backgroundColor: 'rgba(16, 28, 52, 0.85)', fontSize: '15px', fontWeight: '800', color: '#34d399' }}
                    />
                  </div>

                  {/* Category or Payment Method depending on type */}
                  {ocrData.type === 'Expense' ? (
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: '700', color: '#cbd5e1', display: 'block', marginBottom: '3px' }}>
                        Expense Category
                      </label>
                      <select
                        value={ocrData.category || 'Stock'}
                        onChange={(e) => setOcrData({ ...ocrData, category: e.target.value })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.35)', fontSize: '13px', background: 'rgba(16, 28, 52, 0.85)', color: '#ffffff' }}
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
                    <label style={{ fontSize: '11px', fontWeight: '700', color: '#cbd5e1', display: 'block', marginBottom: '3px' }}>
                      Payment Method
                    </label>
                    <select
                      value={ocrData.paymentMethod || 'Cash'}
                      onChange={(e) => setOcrData({ ...ocrData, paymentMethod: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.35)', fontSize: '13px', background: 'rgba(16, 28, 52, 0.85)', color: '#ffffff' }}
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
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', backgroundColor: 'rgba(13, 24, 46, 0.75)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.22)' }}>
                    <div>
                      <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>Subtotal (Taxable)</span>
                      <strong style={{ fontSize: '12px', color: '#ffffff' }}>
                        ₹{ocrData.subtotal || '0.00'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>Tax / GST</span>
                      <strong style={{ fontSize: '12px', color: '#ffffff' }}>
                        ₹{ocrData.tax || '0.00'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>Discount</span>
                      <strong style={{ fontSize: '12px', color: '#38bdf8' }}>
                        ₹{ocrData.discount || '0.00'}
                      </strong>
                    </div>
                  </div>
                )}

                {/* Line Items Table (if any were recognized) */}
                {Array.isArray(ocrData.items) && ocrData.items.length > 0 && (
                  <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '10px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#cbd5e1', display: 'block', marginBottom: '6px' }}>
                      Identified Line Items ({ocrData.items.length}):
                    </span>
                    <div style={{ maxHeight: '140px', overflowY: 'auto', border: '1px solid rgba(59, 130, 246, 0.22)', borderRadius: '8px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', textAlign: 'left', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#ffffff' }}>
                            <th style={{ padding: '6px 10px' }}>Description</th>
                            <th style={{ padding: '6px 10px' }}>Qty</th>
                            <th style={{ padding: '6px 10px' }}>Rate</th>
                            <th style={{ padding: '6px 10px' }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ocrData.items.map((it, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', color: '#cbd5e1' }}>
                              <td style={{ padding: '6px 10px', fontWeight: '600', color: '#ffffff' }}>{it.name}</td>
                              <td style={{ padding: '6px 10px' }}>{it.quantity}</td>
                              <td style={{ padding: '6px 10px' }}>₹{it.unitPrice}</td>
                              <td style={{ padding: '6px 10px', fontWeight: '700', color: '#38bdf8' }}>₹{it.total}</td>
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
                      }}
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        color: '#e2e8f0',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
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
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: PRODUCT QR GENERATOR & INVENTORY HUB                         */}
      {/* =================================================================== */}
      {activeTab === 'qrHub' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Action & Filter Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', backgroundColor: 'rgba(16, 29, 54, 0.75)', padding: '14px 18px', borderRadius: '14px', border: '1px solid rgba(59, 130, 246, 0.22)', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)' }}>
            <input
              type="text"
              placeholder="Search products by name or SKU..."
              value={searchProductQuery}
              onChange={(e) => setSearchProductQuery(e.target.value)}
              style={{ width: '280px', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.35)', backgroundColor: 'rgba(16, 28, 52, 0.75)', color: '#ffffff', fontSize: '13px' }}
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
                  backgroundColor: 'rgba(16, 29, 54, 0.95)',
                  border: '1px solid rgba(59, 130, 246, 0.35)',
                  borderRadius: '16px',
                  padding: '24px',
                  width: '320px',
                  textAlign: 'center',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div style={{ border: '2px solid rgba(59, 130, 246, 0.35)', borderRadius: '12px', padding: '16px', width: '100%', backgroundColor: '#ffffff' }}>
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
                    style={{ flex: 1, backgroundColor: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <Printer size={15} />
                    <span>Print Sticker</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintingProduct(null)}
                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.08)', color: '#e2e8f0', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
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
                backgroundColor: 'rgba(0,0,0,0.65)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                backdropFilter: 'blur(6px)',
              }}
            >
              <form
                onSubmit={handleCreateNewProduct}
                style={{
                  backgroundColor: 'rgba(16, 29, 54, 0.95)',
                  border: '1px solid rgba(59, 130, 246, 0.35)',
                  borderRadius: '16px',
                  padding: '24px',
                  width: '420px',
                  maxWidth: '90%',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#ffffff' }}>
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
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>Product Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Aashirvaad Atta 5kg"
                    value={newProdData.name}
                    onChange={(e) => setNewProdData({ ...newProdData, name: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.35)', backgroundColor: 'rgba(16, 28, 52, 0.75)', color: '#ffffff', fontSize: '13px' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>SKU / Barcode</label>
                    <input
                      type="text"
                      placeholder="e.g. ATTA-5KG"
                      value={newProdData.sku}
                      onChange={(e) => setNewProdData({ ...newProdData, sku: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.35)', backgroundColor: 'rgba(16, 28, 52, 0.75)', color: '#ffffff', fontSize: '13px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>Selling Price (₹) *</label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 260"
                      value={newProdData.price}
                      onChange={(e) => setNewProdData({ ...newProdData, price: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.35)', backgroundColor: 'rgba(16, 28, 52, 0.75)', color: '#ffffff', fontSize: '13px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>Purchase Cost (₹)</label>
                    <input
                      type="number"
                      placeholder="e.g. 220"
                      value={newProdData.costPrice}
                      onChange={(e) => setNewProdData({ ...newProdData, costPrice: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.35)', backgroundColor: 'rgba(16, 28, 52, 0.75)', color: '#ffffff', fontSize: '13px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>Initial Stock</label>
                    <input
                      type="number"
                      placeholder="e.g. 25"
                      value={newProdData.stockQuantity}
                      onChange={(e) => setNewProdData({ ...newProdData, stockQuantity: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.35)', backgroundColor: 'rgba(16, 28, 52, 0.75)', color: '#ffffff', fontSize: '13px' }}
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
                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.08)', color: '#e2e8f0', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Product QR Grid */}
          {loadingProducts ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
              <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px' }} />
              <p style={{ margin: 0, fontSize: '13px' }}>Loading products catalog...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div style={{ backgroundColor: 'rgba(16, 29, 54, 0.75)', borderRadius: '16px', padding: '40px', textAlign: 'center', border: '1px solid rgba(59, 130, 246, 0.22)', boxShadow: '0 8px 30px rgba(0, 0, 0, 0.25)' }}>
              <Package size={36} color="#94a3b8" style={{ margin: '0 auto 10px' }} />
              <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: '800', color: '#ffffff' }}>
                No Products Found
              </h3>
              <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#94a3b8' }}>
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
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>
                      {p.category || 'General'}
                    </span>

                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#ffffff', minHeight: '36px', display: 'flex', alignItems: 'center' }}>
                      {p.name}
                    </h4>

                    {/* Scannable QR Code Box */}
                    <div className="qr-sticker-box">
                      <QRCodeSVG value={qrPayload} size={105} />
                      <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700' }}>
                        {p.sku || p._id.slice(-6)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginTop: '2px' }}>
                      <strong style={{ fontSize: '16px', fontWeight: '900', color: '#34d399' }}>
                        ₹{p.price}
                      </strong>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          color: p.stockQuantity <= 5 ? '#f87171' : '#34d399',
                          backgroundColor: p.stockQuantity <= 5 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          border: `1px solid ${p.stockQuantity <= 5 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
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
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          backgroundColor: 'rgba(255, 255, 255, 0.08)',
                          fontSize: '11px',
                          fontWeight: '700',
                          color: '#e2e8f0',
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
