require('dotenv').config();
const express = require('express');
const midtransClient = require('midtrans-client');
const db = require('./db'); 

const app = express();
const port = process.env.PORT || 3000;

// --- MIDDLEWARE ---
app.use(express.json()); 
app.use(express.static('public')); 

// --- KONFIGURASI MIDTRANS ---
let snap = new midtransClient.Snap({
    isProduction: false, 
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY
});

// --- 1. ENDPOINT: BUAT TRANSAKSI MIDTRANS (TOKEN) ---
app.post('/api/midtrans/charge', async (req, res) => {
    const { nama_pemesan, total_belanja } = req.body;
    
    // Membuat Order ID unik berdasarkan timestamp agar tidak bentrok
    const order_id = "CB-" + Date.now();

    let parameter = {
        "transaction_details": {
            "order_id": order_id,
            "gross_amount": total_belanja
        },
        "customer_details": {
            "first_name": nama_pemesan
        },
        "usage_limit": 1
    };

    try {
        const transaction = await snap.createTransaction(parameter);
        console.log(`✅ Token Berhasil Dibuat: ${transaction.token}`);
        res.json({ token: transaction.token, order_id: order_id });
    } catch (error) {
        console.error("❌ Midtrans Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// --- 2. ENDPOINT: SIMPAN PESANAN KE DATABASE ---
app.post('/api/checkout', (req, res) => {
    const dataPesanan = req.body; 
    const order_id = "ORD-" + Math.floor(Math.random() * 100000);
    const status = "Lunas"; 

    console.log("🛒 Menyimpan Pesanan ke Database...");
    
    dataPesanan.detail_pesanan.forEach(kue => {
        const product_id = 1; 
        const quantity = 1;
        const total = kue.harga;

        const sql = "INSERT INTO orders (order_id, customer_name, payment_method, product_name, product_id, quantity, total, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        const values = [order_id, dataPesanan.nama_pemesan, dataPesanan.metode_pembayaran, kue.nama, product_id, quantity, total, status];

        db.query(sql, values, (err, result) => {
            if (err) {
                console.error("❌ Gagal menyimpan ke DB:", err);
            } else {
                console.log(`✅ Tersimpan: [${kue.nama}]`);
            }
        });
    });

    res.status(200).json({ success: true, message: "Pesanan masuk Database!" });
});

// --- 3. ENDPOINT: DASHBOARD ADMIN ---
app.get('/api/dashboard', (req, res) => {
    const querySummary = "SELECT COUNT(DISTINCT order_id) as total_transaksi, SUM(total) as total_pendapatan FROM orders";
    
    db.query(querySummary, (err, summaryResult) => {
        if (err) return res.status(500).json({ error: "Gagal ambil summary" });
        
        const totalTransaksi = summaryResult[0].total_transaksi || 0;
        const totalPendapatan = summaryResult[0].total_pendapatan || 0;

        const queryRiwayat = `
            SELECT 
                order_id, customer_name, payment_method, created_at, 
                SUM(total) as total_belanja, status,
                GROUP_CONCAT(product_name SEPARATOR ', ') as pesanan_kue
            FROM orders 
            GROUP BY order_id, customer_name, payment_method, created_at, status 
            ORDER BY created_at DESC 
            LIMIT 10
        `;
        
        db.query(queryRiwayat, (err, riwayatResult) => {
            if (err) return res.status(500).json({ error: "Gagal ambil riwayat" });

            const formatRiwayat = riwayatResult.map(row => ({
                created_at: row.created_at,
                customer_name: row.customer_name,
                payment_method: row.payment_method,
                daftar_kue: row.pesanan_kue,
                total_belanja: row.total_belanja,
                status: row.status
            }));

            res.json({
                total_transaksi: totalTransaksi,
                total_pendapatan: totalPendapatan,
                riwayat_pesanan: formatRiwayat
            });
        });
    });
});

// --- START SERVER ---
app.listen(port, () => {
    console.log(`
🚀 Server CreamyBites Aktif!
📍 URL: http://localhost:${port}
🛠️ Mode: Development (Sandbox)
    `);
});