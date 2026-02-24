let keranjang = []; 
let totalBelanja = 0;

const teksKeranjang = document.getElementById('angka-keranjang');
const semuaTombolBeli = document.querySelectorAll('.btn-beli');
const modalKeranjang = document.getElementById('modal-keranjang');
const btnBukaKeranjang = document.getElementById('btn-buka-keranjang');
const btnTutupKeranjang = document.getElementById('btn-tutup-keranjang');
const daftarBelanjaUI = document.getElementById('daftar-belanja');
const totalHargaUI = document.getElementById('total-harga');
const btnBayar = document.getElementById('btn-bayar');
const dropdownPembayaran = document.getElementById('pilihan-pembayaran');
const infoPembayaran = document.getElementById('info-pembayaran');

// --- LOGIKA KERANJANG ---
semuaTombolBeli.forEach(function(tombol) {
    tombol.addEventListener('click', function(event) {
        const kartuProduk = event.target.closest('.produk-card');
        const namaProduk = kartuProduk.querySelector('h3').innerText;
        const teksHarga = kartuProduk.querySelector('.harga').innerText;
        const hargaAngka = parseInt(teksHarga.replace(/[^0-9]/g, ''));

        keranjang.push({ nama: namaProduk, harga: hargaAngka });
        teksKeranjang.innerText = keranjang.length;
        alert(`✅ ${namaProduk} masuk ke keranjang!`);
    });
});

btnBukaKeranjang.addEventListener('click', function(event) {
    event.preventDefault(); 
    daftarBelanjaUI.innerHTML = '';
    totalBelanja = 0;

    if(keranjang.length === 0) {
        daftarBelanjaUI.innerHTML = '<li>Keranjang kosong!</li>';
    } else {
        keranjang.forEach(function(item) {
            const li = document.createElement('li');
            const hargaRupiah = 'Rp ' + item.harga.toLocaleString('id-ID');
            li.innerHTML = `<span>${item.nama}</span> <span>${hargaRupiah}</span>`;
            daftarBelanjaUI.appendChild(li);
            totalBelanja += item.harga;
        });
    }

    totalHargaUI.innerText = 'Rp ' + totalBelanja.toLocaleString('id-ID');
    modalKeranjang.style.display = 'block';
});

btnTutupKeranjang.addEventListener('click', () => modalKeranjang.style.display = 'none');
window.addEventListener('click', (e) => { if (e.target == modalKeranjang) modalKeranjang.style.display = 'none'; });

// --- LOGIKA UTAMA PEMBAYARAN MIDTRANS ---
btnBayar.addEventListener('click', async function() {
    const namaPemesan = document.getElementById('nama-pemesan').value;
    
    // Validasi input
    if(keranjang.length === 0) return alert("Keranjang Anda masih kosong!");
    if(namaPemesan.trim() === "") return alert("Mohon isi Nama Pemesan terlebih dahulu!");

    btnBayar.innerText = "Memproses...";
    btnBayar.disabled = true;

    try {
        // 1. Ambil Token dari Server Backend
        const response = await fetch('/api/midtrans/charge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nama_pemesan: namaPemesan,
                total_belanja: totalBelanja,
                item_details: keranjang // Mengirim detail item jika diperlukan
            })
        });

        const data = await response.json();

        if (data.token) {
            // 2. Munculkan Jendela Pembayaran Midtrans (Snap)
            window.snap.pay(data.token, {
                onSuccess: function(result) {
                    alert("Pembayaran Berhasil! Pesanan Anda segera diproses.");
                    simpanPesananKeDatabase(namaPemesan, totalBelanja, result);
                },
                onPending: function(result) {
                    alert("Pesanan disimpan. Segera selesaikan pembayaran Anda!");
                    simpanPesananKeDatabase(namaPemesan, totalBelanja, result);
                },
                onError: function(result) {
                    alert("Pembayaran Gagal. Silakan coba lagi.");
                    console.error(result);
                },
                onClose: function() {
                    alert('Anda belum menyelesaikan pembayaran.');
                }
            });
        } else {
            alert("Gagal mendapatkan token pembayaran dari server.");
        }
    } catch (error) {
        console.error("Error:", error);
        alert("Terjadi kesalahan sistem saat menghubungi Midtrans.");
    } finally {
        btnBayar.innerText = "Selesaikan Pesanan";
        btnBayar.disabled = false;
    }
});

// Fungsi pembantu untuk mencatat pesanan ke database setelah Midtrans merespon
async function simpanPesananKeDatabase(nama, total, resultMidtrans) {
    try {
        await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nama_pemesan: nama,
                total_belanja: total,
                metode_pembayaran: resultMidtrans.payment_type || 'Midtrans',
                detail_pesanan: keranjang
            })
        });

        // Reset Keranjang
        keranjang = [];
        teksKeranjang.innerText = '0';
        modalKeranjang.style.display = 'none';
        document.getElementById('nama-pemesan').value = "";
    } catch (err) {
        console.log("Gagal mencatat pesanan ke database lokal:", err);
    }
}