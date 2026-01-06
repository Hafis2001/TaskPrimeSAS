import { Alert, PermissionsAndroid, Platform } from "react-native";
import { BLEPrinter, USBPrinter } from "react-native-thermal-receipt-printer";

class PrinterService {
    constructor() {
        this.connected = false;
        this.currentPrinter = null;
        this.connectionType = 'ble'; // 'ble' | 'usb'
        this.isBLEInitialized = false;
        this.isUSBInitialized = false;
    }

    async requestPermissions() {
        if (Platform.OS === "android") {
            try {
                if (Platform.Version >= 31) {
                    const grants = await PermissionsAndroid.requestMultiple([
                        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                    ]);

                    if (
                        grants[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED &&
                        grants[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED
                    ) {
                        return true;
                    }
                } else {
                    const grants = await PermissionsAndroid.requestMultiple([
                        PermissionsAndroid.PERMISSIONS.BLUETOOTH,
                        PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADMIN,
                        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                    ]);

                    if (grants[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED) {
                        return true;
                    }
                }
                return true;
            } catch (err) {
                console.warn(err);
                return false;
            }
        }
        return true;
    }

    async init(type = 'ble') {
        try {
            console.log(`[Printer] Starting initialization for ${type}...`);

            // 1. Request permissions FIRST. 
            const hasPermissions = await this.requestPermissions();

            // Even if permissions fail, we might try USB (which sometimes doesn't need runtime perms on old androids, but good to have)

            if (type === 'ble') {
                if (this.isBLEInitialized) return;

                if (!hasPermissions) {
                    console.warn("[Printer] BLE Permissions denied.");
                    return;
                }

                // Initialize BLE
                try {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    await BLEPrinter.init();
                    this.isBLEInitialized = true;
                    console.log("[Printer] BLE Init Success");
                } catch (err) {
                    console.warn("[Printer] BLE Init Failed:", err);
                }
            } else if (type === 'usb') {
                if (this.isUSBInitialized) return;

                // Initialize USB
                try {
                    await USBPrinter.init();
                    this.isUSBInitialized = true;
                    console.log("[Printer] USB Init Success");
                } catch (err) {
                    console.warn("[Printer] USB Init Failed:", err);
                }
            }
        } catch (error) {
            console.error("[Printer] Init Critical Failure:", error);
        }
    }

    async getDeviceList(type = 'ble') {
        try {
            // Ensure initialized only for the specific type
            await this.init(type);

            this.connectionType = type;
            if (type === 'ble') {
                const hasPerm = await this.requestPermissions();
                if (!hasPerm) {
                    console.log("[Printer] No permissions for BLE scan");
                    return [];
                }

                // Wrap in try-catch specifically for the native call
                try {
                    const devices = await BLEPrinter.getDeviceList();
                    console.log("[Printer] BLE Devices found:", devices);
                    return devices || [];
                } catch (e) {
                    console.warn("[Printer] BLE friendly scan error:", e);
                    return [];
                }
            } else {
                // USB
                try {
                    const devices = await USBPrinter.getDeviceList();
                    console.log("[Printer] USB Devices found:", devices);
                    return devices || [];
                } catch (e) {
                    console.warn("[Printer] USB friendly scan error:", e);
                    return [];
                }
            }
        } catch (err) {
            console.error("[Printer] General Scan error:", err);
            return [];
        }
    }

    async connect(device) {
        try {
            let printerMac = device.inner_mac_address || device.vendor_id;
            console.log(`[Printer] Connecting to ${this.connectionType}:`, printerMac);

            if (this.connectionType === 'ble') {
                await BLEPrinter.connectPrinter(printerMac);
            } else {
                await USBPrinter.connectPrinter(device.vendor_id, device.product_id);
            }

            this.connected = true;
            this.currentPrinter = device;
            console.log("[Printer] Connected successfully");
            return true;
        } catch (err) {
            console.error("[Printer] Connection failed:", err);
            this.connected = false;
            return false;
        }
    }

    async printOrder(order) {
        try {
            if (!this.connected) {
                // Try to reconnect if we have a current printer
                if (this.currentPrinter) {
                    console.log("[Printer] Attempting to reconnect before printing...");
                    const reconnected = await this.connect(this.currentPrinter);
                    if (!reconnected) {
                        Alert.alert("Printer Disconnected", "Please reconnect to your printer.");
                        return false;
                    }
                } else {
                    Alert.alert("Printer not connected", "Please connect to a printer first.");
                    return false;
                }
            }

            const PrinterInterface = this.connectionType === 'ble' ? BLEPrinter : USBPrinter;

            const PRINTER_WIDTH = 32;

            const centerText = (text) => {
                const safeText = String(text || "");
                const pad = Math.max(0, Math.floor((PRINTER_WIDTH - safeText.length) / 2));
                return " ".repeat(pad) + safeText + "\n";
            };

            const line = "-".repeat(PRINTER_WIDTH) + "\n";

            let receipt = "";

            // Header
            receipt += centerText("TaskSAS");
            receipt += centerText("Order Receipt");
            receipt += line;
            receipt += `Date: ${new Date(order.timestamp).toLocaleString()}\n`;
            if (order.customer) receipt += `Customer: ${order.customer}\n`;
            if (order.area) receipt += `Area: ${order.area}\n`;
            receipt += line;

            // Table Header
            receipt += "Item                Qty     Price\n";
            receipt += line;

            // Items
            let totalAmount = 0;
            if (Array.isArray(order.items)) {
                order.items.forEach(item => {
                    const price = Number(item.price) || 0;
                    const qty = Number(item.qty) || 0;
                    const itemTotal = price * qty;
                    totalAmount += itemTotal;

                    const name = String(item.name || "Item").substring(0, 18).padEnd(20, " ");
                    const qtyStr = String(qty).padStart(3, " ");
                    const priceStr = itemTotal.toFixed(2).padStart(9, " ");

                    receipt += `${name}${qtyStr}${priceStr}\n`;
                });
            }

            receipt += line;

            // Total
            const totalLabel = "TOTAL:";
            const totalVal = totalAmount.toFixed(2);
            const totalPad = PRINTER_WIDTH - totalLabel.length - totalVal.length;
            receipt += `${totalLabel}${" ".repeat(Math.max(0, totalPad))}${totalVal}\n`;

            receipt += line;
            receipt += centerText("Thank You!");
            receipt += "\n\n\n";

            await PrinterInterface.printBill(receipt);
            return true;

        } catch (err) {
            console.error("[Printer] Print failed:", err);
            Alert.alert("Print Error", "Failed to send data to printer. Please check connection.");
            this.connected = false; // Mark as disconnected so user can try reconnecting
            return false;
        }
    }
}

export default new PrinterService();
