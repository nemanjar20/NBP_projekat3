const apiUrl = '/products';

let allProducts = [];

// dodaje novo polje za unos kljuc-vrednost (naziv i vrednost atributa proizvoda)
function addDynamicField() {
    const container = document.getElementById('dynamicFields');
    const div = document.createElement('div');
    div.className = 'dynamic-field';
    div.innerHTML = `
    <input type="text" class="field-key" placeholder="Naziv polja (npr. size, author)" />
    <input type="text" class="field-value" placeholder="Vrednost" />
    <button type="button" class="remove-btn" title="Ukloni polje">
        <span>×</span>
    </button>
    `;
    container.appendChild(div);

    div.querySelector('.remove-btn').addEventListener('click', () => div.remove());
}

// obrada submit-a forme za dodavanje proizvoda
function handleFormSubmit(e) {
    e.preventDefault();

    const data = {
        type: document.getElementById('type').value.trim(),
        name: document.getElementById('name').value.trim(),
        price: parseFloat(document.getElementById('price').value),
        imageUrl: document.getElementById('imageUrl').value.trim() || ''
    };

    document.querySelectorAll('.dynamic-field').forEach(field => {
        const key = field.querySelector('.field-key').value.trim();
        const value = field.querySelector('.field-value').value.trim();
        if (key && value) {
            data[key] = value;
        }
    });

    fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(res => {
        if (!res.ok) throw new Error('Greska pri cuvanju: ' + res.status);
        return res.json();
    })
    .then(() => {
        document.getElementById('productForm').reset();
        document.getElementById('dynamicFields').innerHTML = '';
        loadProducts();
        alert('Proizvod uspesno dodat!');
    })
    .catch(err => {
        alert('Greska: ' + err.message);
    });
}

// brise proizvod
function deleteProduct(id) {
    if (!confirm('Da li ste sigurni da zelite da obrisete ovaj proizvod?')) return;

    fetch(`${apiUrl}/${id}`, { method: 'DELETE' })
    .then(res => {
        if (!res.ok) throw new Error('Greska pri brisanju');
        loadProducts();
        alert('Proizvod obrisan!');
    })
    .catch(err => alert('Greska: ' + err.message));
}

// simulacija kupovine (za korisnika)
function buyProduct(name) {
    alert(`Hvala! Kupili ste: ${name}. (Ovo je samo simulacija)`);
}

// ucitava sve proizvode sa servera
async function loadProducts() {
    try {
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error('Ne moze da ucita proizvode');
        allProducts = await res.json();
        renderProducts(allProducts);
    } catch (err) {
        document.getElementById('productsList').innerHTML = 
            `<p class="error">Greska pri ucitavanju: ${err.message}</p>`;
    }
}

// crta kartice svih proizvoda na ekranu
function renderProducts(products) {
    const container = document.getElementById('productsList');
    container.innerHTML = '';

    if (products.length === 0) {
        container.innerHTML = '<p class="empty">Jos nema proizvoda u bazi.</p>';
        return;
    }

    const isAdmin = document.getElementById('role').value === 'admin';

    products.forEach(p => {
        const card = document.createElement('div');
        card.className = 'product-card';

        // slika ili placeholder
        const imgContainer = `
            <div class="image-container">
                ${p.imageUrl 
                    ? `<img src="${p.imageUrl}" alt="${p.name || 'Proizvod'}" 
                           onerror="this.src='https://via.placeholder.com/320x200/cccccc/777777?text=Slika+nedostaje'">`
                    : `<img src="https://via.placeholder.com/320x200/cccccc/777777?text=Bez+slike" 
                           alt="Bez slike" class="placeholder-img">`
                }
            </div>`;

        // atributi
        let attributesHtml = '<div class="attributes-container"><ul class="product-attributes">';
        
        
        const keyTranslations = {
            type: 'Tip',
            name: 'Naziv',
            price: 'Cena',
            /*
            size: 'Velicina',
            color: 'Boja',
            material: 'Materijal',
            author: 'Autor',
            pages: 'Broj strana',
            isbn: 'ISBN',
            ram: 'RAM',
            storage: 'Memorija',
            processor: 'Procesor',
            cameraMp: 'Kamera (MP)'
            */
        };

        for (const [key, value] of Object.entries(p)) {
            if (key !== '_id' && key !== 'imageUrl' && key !== 'createdAt') {
                const displayKey = keyTranslations[key] || 
                                  key.charAt(0).toUpperCase() + key.slice(1);
                attributesHtml += `<li><strong>${displayKey}:</strong> ${value}</li>`;
            }
        }
        attributesHtml += '</ul></div>';


        // dobijanje ID-a kao stringa
        let idString = '';
        if (typeof p._id === 'string') {
            idString = p._id;
        } else if (p._id && typeof p._id === 'object' && p._id.$oid) {
            idString = p._id.$oid;
        } else if (p._id) {
            idString = p._id.toString();
        } else {
            console.warn('Proizvod bez validnog _id:', p);
            idString = ''; 
        }

        // dugmad
        let buttonHtml = '';
        if (isAdmin) {
            buttonHtml = `
                <div class="admin-buttons" style="display: flex; gap: 10px; margin-top: 1rem;">
                    <button class="action-button delete-btn" style="flex: 1;" 
                            onclick="deleteProduct('${idString}')">
                        Obrisi
                    </button>
                    <button class="action-button edit-btn" style="flex: 1;" 
                        onclick="openEditModal('${idString}')">
                        Izmeni
                    </button>
                </div>`;
        } else {
            buttonHtml = `
                <button class="action-button buy-btn" 
                        onclick="buyProduct('${p.name || 'Proizvod'}')">
                    Kupi
                </button>`;
        }

        card.innerHTML = imgContainer + attributesHtml + buttonHtml;
        container.appendChild(card);
    });
}

// filtrira proizvode po pretrazi
function handleSearch() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const filtered = allProducts.filter(p => 
        (p.name && p.name.toLowerCase().includes(query)) ||
        (p.type && p.type.toLowerCase().includes(query))
    );
    renderProducts(filtered);
}

// promena uloge user/admin
function handleRoleChange() {
    const role = document.getElementById('role').value;
    
    const adminSection = document.querySelector('.admin-only');
    const userSection  = document.querySelector('.user-only');
    
    // admin vidi formu za dodavanje, ne vidi pretragu
    if (role === 'admin') {
        adminSection.classList.add('visible');
        userSection.classList.remove('visible');
    } else {
        adminSection.classList.remove('visible');
        userSection.classList.add('visible');
    }
    
    // osvezavamo listu proizvoda da bi dugmad bila ispravna
    loadProducts();
}

//otvara modal za izmenu proizvoda
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('addFieldBtn').addEventListener('click', addDynamicField);
    document.getElementById('productForm').addEventListener('submit', handleFormSubmit);
    document.getElementById('searchInput').addEventListener('input', handleSearch);
    document.getElementById('role').addEventListener('change', handleRoleChange);

    handleRoleChange();
    loadProducts();
});

// ostali globalni eventi i funkcije ostaju van
window.deleteProduct = deleteProduct;
window.buyProduct = buyProduct;

// dodaje jedno dinamicko polje u edit modal
function openEditModal(id) {
    // pronalazenje proizvoda po ID-u iz allProducts
    const product = allProducts.find(p => {
        const prodId = typeof p._id === 'string' ? p._id : (p._id.$oid || p._id.toString());
        return prodId === id;
    });

    if (!product) {
        alert('Proizvod nije pronadjen!');
        return;
    }

    // popunjavanje forme
    document.getElementById('editId').value = id;
    document.getElementById('editType').value = product.type || '';
    document.getElementById('editName').value = product.name || '';
    document.getElementById('editPrice').value = product.price || '';
    document.getElementById('editImageUrl').value = product.imageUrl || '';

    // popunjavanje dinamickog polja
    const container = document.getElementById('editDynamicFields');
    container.innerHTML = '';

    for (const [key, value] of Object.entries(product)) {
        if (key !== '_id' && key !== 'type' && key !== 'name' && key !== 'price' && key !== 'imageUrl' && key !== 'createdAt') {
            addEditDynamicField(key, value);
        }
    }

    document.getElementById('editModal').style.display = 'block';
}

// zatvaranje edit modala
function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
    document.getElementById('editDynamicFields').innerHTML = '';
}

// dodavanje dinamickog polja u edit modalu
function addEditDynamicField(key = '', value = '') {
    const container = document.getElementById('editDynamicFields');
    const div = document.createElement('div');
    div.className = 'dynamic-field';
    div.innerHTML = `
        <input type="text" class="field-key" value="${key}" placeholder="Naziv polja" />
        <input type="text" class="field-value" value="${value}" placeholder="Vrednost" />
        <button type="button" class="remove-btn">×</button>
    `;
    container.appendChild(div);

    div.querySelector('.remove-btn').addEventListener('click', () => div.remove());
}

// submit izmene
document.getElementById('editForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = document.getElementById('editId').value;
    const data = {
        type: document.getElementById('editType').value.trim(),
        name: document.getElementById('editName').value.trim(),
        price: parseFloat(document.getElementById('editPrice').value),
        imageUrl: document.getElementById('editImageUrl').value.trim() || ''
    };

    document.querySelectorAll('#editDynamicFields .dynamic-field').forEach(field => {
        const key = field.querySelector('.field-key').value.trim();
        const value = field.querySelector('.field-value').value.trim();
        if (key && value) {
            data[key] = value;
        }
    });

    try {
        const res = await fetch(`${apiUrl}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(errText || `Greska ${res.status}`);
        }

        closeEditModal();
        loadProducts();
        alert('Proizvod uspesno izmenjen!');
    } catch (err) {
        alert('Greska pri izmeni: ' + err.message);
    }
});



