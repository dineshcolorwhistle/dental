import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  Search,
  X,
  AlertCircle,
  Loader2,
  Trash2,
  Edit2,
  Package,
  Layers,
  XCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuth } from '../context';
import {
  inventoryService,
  branchService,
  type InventoryItem,
  type InventoryCategory,
  type BranchListItem,
} from '../services';
import { Pagination } from '../components';

const PAGE_SIZE = 10;
type ActiveTab = 'ITEMS' | 'CATEGORIES';

export function InventoryPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isOwner = user?.role === 'OWNER' || user?.role === 'SUPER_ADMIN';
  const canEdit = isAdmin || isOwner;
  const canCreate = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const canDelete = isOwner;

  // State
  const [activeTab, setActiveTab] = useState<ActiveTab>('ITEMS');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [branches, setBranches] = useState<BranchListItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('ALL');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(0);

  // Category Filters
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [selectedCategoryStatusFilter, setSelectedCategoryStatusFilter] = useState('ALL');
  const [selectedCategoryProductTypeFilter, setSelectedCategoryProductTypeFilter] = useState('ALL');
  const [categoryCurrentPage, setCategoryCurrentPage] = useState(0);

  // Modals
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);

  // Category Form
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<InventoryCategory | null>(null);
  const [categorySaving, setCategorySaving] = useState(false);
  const [showCategoryDeleteModal, setShowCategoryDeleteModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<InventoryCategory | null>(null);
  const [showCategoryInUseModal, setShowCategoryInUseModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    status: 'active',
    productType: 'for_use',
  });

  // Item Form
  const [savingItem, setSavingItem] = useState(false);
  const [itemForm, setItemForm] = useState({
    name: '',
    sku: '',
    categoryId: '',
    status: 'IN_STOCK',
    currentQuantity: 0,
    minQuantity: 5,
    unitPrice: 0,
    brand: '',
    supplier: '',
    expiryDate: '',
    description: '',
    branchId: '',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Fetch all initial data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const branchScope = isAdmin ? user?.branchId || undefined : undefined;

      const [itemsData, categoriesData, branchesData] = await Promise.all([
        inventoryService.getAllItems({ branchId: branchScope }),
        inventoryService.getCategories(),
        isAdmin ? Promise.resolve([]) : branchService.getAll(),
      ]);

      setItems(itemsData);
      setCategories(categoriesData);
      setBranches(branchesData.filter((b) => b.isActive));
    } catch (err) {
      toast.error(t('common.failedLoadReference'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, user?.branchId, t]);

  useEffect(() => {
    setCurrentPage(0);
  }, [searchQuery, selectedBranchFilter, selectedCategoryFilter, selectedStatusFilter]);

  useEffect(() => {
    setCategoryCurrentPage(0);
  }, [categorySearchQuery, selectedCategoryStatusFilter, selectedCategoryProductTypeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // SKU Auto Generator
  const generateSku = () => {
    const today = new Date();
    const yyyymmdd = today.getFullYear().toString() +
      (today.getMonth() + 1).toString().padStart(2, '0') +
      today.getDate().toString().padStart(2, '0');
    const random = Math.floor(1000 + Math.random() * 9000);
    return `INV-${yyyymmdd}-${random}`;
  };

  // Open item form modal
  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setItemForm({
      name: '',
      sku: generateSku(),
      categoryId: categories[0]?.id || '',
      status: 'IN_STOCK',
      currentQuantity: 0,
      minQuantity: 5,
      unitPrice: 0,
      brand: '',
      supplier: '',
      expiryDate: '',
      description: '',
      branchId: isAdmin ? user?.branchId || '' : '',
    });
    setFormErrors({});
    setShowItemModal(true);
  };

  const handleOpenEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      sku: item.sku,
      categoryId: item.categoryId,
      status: item.status,
      currentQuantity: item.currentQuantity,
      minQuantity: item.minQuantity,
      unitPrice: item.unitPrice,
      brand: item.brand || '',
      supplier: item.supplier || '',
      expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString().split('T')[0] : '',
      description: item.description || '',
      branchId: item.branchId || '',
    });
    setFormErrors({});
    setShowItemModal(true);
  };

  // Form input handlers
  const handleInputChange = (field: string, value: any) => {
    setItemForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Validation
  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!itemForm.name.trim()) errors.name = t('validation.fieldRequired');
    if (!itemForm.sku.trim()) errors.sku = t('validation.fieldRequired');
    if (!itemForm.categoryId) errors.categoryId = t('validation.fieldRequired');
    if (!itemForm.status) errors.status = t('validation.fieldRequired');
    if (itemForm.currentQuantity < 0) errors.currentQuantity = t('validation.invalidNumber');
    if (itemForm.minQuantity < 0) errors.minQuantity = t('validation.invalidNumber');
    if (itemForm.unitPrice < 0) errors.unitPrice = t('validation.invalidNumber');

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save Item (Create/Update)
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setSavingItem(true);
      const payload = {
        name: itemForm.name,
        sku: itemForm.sku,
        categoryId: itemForm.categoryId,
        status: itemForm.status,
        currentQuantity: Number(itemForm.currentQuantity),
        minQuantity: Number(itemForm.minQuantity),
        unitPrice: Number(itemForm.unitPrice),
        brand: itemForm.brand || undefined,
        supplier: itemForm.supplier || undefined,
        expiryDate: itemForm.expiryDate ? new Date(itemForm.expiryDate).toISOString() : undefined,
        description: itemForm.description || undefined,
        branchId: itemForm.branchId || undefined,
      };

      if (editingItem) {
        await inventoryService.updateItem(editingItem.id, payload);
        toast.success(t('inventory.messages.updateSuccess'));
      } else {
        await inventoryService.createItem(payload);
        toast.success(t('inventory.messages.createSuccess'));
      }

      setShowItemModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('common.failedLoadReference'));
    } finally {
      setSavingItem(false);
    }
  };

  // Delete Item
  const handleOpenDeleteModal = (item: InventoryItem) => {
    setItemToDelete(item);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await inventoryService.deleteItem(itemToDelete.id);
      toast.success(t('inventory.messages.deleteSuccess'));
      setShowDeleteModal(false);
      setItemToDelete(null);
      fetchData();
    } catch (err) {
      toast.error(t('common.failedLoadReference'));
    }
  };

  // Create Category
  const handleOpenCategoryCreateModal = () => {
    setEditingCategory(null);
    setCategoryForm({
      name: '',
      description: '',
      status: 'active',
      productType: 'for_use',
    });
    setShowCategoryModal(true);
  };

  // Edit Category
  const handleOpenCategoryEditModal = (category: InventoryCategory) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      description: category.description || '',
      status: category.status,
      productType: category.productType,
    });
    setShowCategoryModal(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) return;

    try {
      setCategorySaving(true);
      const payload = {
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim() || undefined,
        status: categoryForm.status,
        productType: categoryForm.productType,
      };

      if (editingCategory) {
        await inventoryService.updateCategory(editingCategory.id, payload);
        toast.success(t('inventory.messages.categoryUpdateSuccess', { defaultValue: 'Category updated successfully!' }));
      } else {
        await inventoryService.createCategory(payload);
        toast.success(t('inventory.messages.categoryCreateSuccess'));
      }

      setShowCategoryModal(false);
      setEditingCategory(null);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('common.failedLoadReference'));
    } finally {
      setCategorySaving(false);
    }
  };

  // Delete Category
  const handleOpenCategoryDeleteModal = (category: InventoryCategory) => {
    // Check if category is assigned to any inventory items
    const isAssigned = items.some((item) => item.categoryId === category.id);
    if (isAssigned) {
      setShowCategoryInUseModal(true);
      return;
    }
    setCategoryToDelete(category);
    setShowCategoryDeleteModal(true);
  };

  const handleConfirmCategoryDelete = async () => {
    if (!categoryToDelete) return;
    try {
      await inventoryService.deleteCategory(categoryToDelete.id);
      toast.success(t('inventory.messages.categoryDeleteSuccess'));
      setShowCategoryDeleteModal(false);
      setCategoryToDelete(null);
      fetchData();
    } catch (err) {
      setShowCategoryInUseModal(true);
    }
  };

  // Metrics
  const metrics = useMemo(() => {
    const total = items.length;
    const low = items.filter(
      (item) => item.currentQuantity <= item.minQuantity && item.status !== 'OUT_OF_STOCK'
    ).length;
    const out = items.filter(
      (item) => item.currentQuantity === 0 || item.status === 'OUT_OF_STOCK'
    ).length;

    return { total, low, out };
  }, [items]);

  // Filtered Inventory List
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Branch filter (owners only)
      if (!isAdmin && selectedBranchFilter !== 'ALL' && item.branchId !== selectedBranchFilter) return false;
      // Category filter
      if (selectedCategoryFilter !== 'ALL' && item.categoryId !== selectedCategoryFilter) return false;
      // Status filter
      if (selectedStatusFilter !== 'ALL' && item.status !== selectedStatusFilter) return false;

      // Search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(query) ||
          item.sku.toLowerCase().includes(query) ||
          (item.brand && item.brand.toLowerCase().includes(query)) ||
          (item.supplier && item.supplier.toLowerCase().includes(query)) ||
          (item.category?.name && item.category.name.toLowerCase().includes(query))
        );
      }

      return true;
    });
  }, [items, selectedBranchFilter, selectedCategoryFilter, selectedStatusFilter, searchQuery, isAdmin]);

  // Paginated Inventory List
  const paginatedItems = useMemo(() => {
    const startIndex = currentPage * PAGE_SIZE;
    return filteredItems.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredItems, currentPage]);

  // Filtered Categories List
  const filteredCategories = useMemo(() => {
    return categories.filter((cat) => {
      // Status filter
      if (selectedCategoryStatusFilter !== 'ALL' && cat.status !== selectedCategoryStatusFilter) return false;
      // Product Type filter
      if (selectedCategoryProductTypeFilter !== 'ALL' && cat.productType !== selectedCategoryProductTypeFilter) return false;

      // Search query
      if (categorySearchQuery) {
        const query = categorySearchQuery.toLowerCase();
        return (
          cat.name.toLowerCase().includes(query) ||
          (cat.description && cat.description.toLowerCase().includes(query))
        );
      }

      return true;
    });
  }, [categories, selectedCategoryStatusFilter, selectedCategoryProductTypeFilter, categorySearchQuery]);

  const paginatedCategories = useMemo(() => {
    const start = categoryCurrentPage * PAGE_SIZE;
    return filteredCategories.slice(start, start + PAGE_SIZE);
  }, [filteredCategories, categoryCurrentPage]);

  // Format Price
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat(i18n.language?.startsWith('es') ? 'es-MX' : 'en-US', {
      style: 'currency',
      currency: 'MXN',
    }).format(price);
  };

  // Format Date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString(
      i18n.language?.startsWith('es') ? 'es-MX' : 'en-US',
      { day: 'numeric', month: 'short', year: 'numeric' }
    );
  };

  return (
    <div className="admins-page">
      {/* Page Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{t('inventory.title')}</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{t('inventory.description')}</p>
        </div>

        <div className="tab-navigation" style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'var(--bg-light)', padding: '0.25rem', borderRadius: '8px' }}>
          <button
            className={`btn ${activeTab === 'ITEMS' ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => setActiveTab('ITEMS')}
            style={{ padding: '0.5rem 1rem', borderRadius: '6px' }}
          >
            <Package size={16} style={{ marginRight: '0.5rem' }} />
            {t('inventory.tabs.items')}
          </button>
          <button
            className={`btn ${activeTab === 'CATEGORIES' ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => setActiveTab('CATEGORIES')}
            style={{ padding: '0.5rem 1rem', borderRadius: '6px' }}
          >
            <Layers size={16} style={{ marginRight: '0.5rem' }} />
            {t('inventory.tabs.categories')}
          </button>
        </div>
      </header>

      {activeTab === 'ITEMS' ? (
        <>
          {canCreate && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <button
                className="btn btn--primary"
                onClick={handleOpenCreateModal}
              >
                <Plus size={18} />
                <span>{t('inventory.buttons.addItem')}</span>
              </button>
            </div>
          )}

          {/* Stats */}
          <div className="tenants-page__stats">
            <div className="stat-card">
              <div className="stat-card__icon stat-card__icon--primary">
                <Package size={24} style={{ color: 'var(--accent-primary)' }} />
              </div>
              <div className="stat-card__content">
                <span className="stat-card__value">{metrics.total}</span>
                <span className="stat-card__label">{t('inventory.metrics.totalItems')}</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-card__icon stat-card__icon--warning">
                <AlertCircle size={24} style={{ color: 'var(--warning)' }} />
              </div>
              <div className="stat-card__content">
                <span className="stat-card__value">{metrics.low}</span>
                <span className="stat-card__label">{t('inventory.metrics.lowStock')}</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-card__icon stat-card__icon--danger">
                <XCircle size={24} style={{ color: 'var(--danger)' }} />
              </div>
              <div className="stat-card__content">
                <span className="stat-card__value">{metrics.out}</span>
                <span className="stat-card__label">{t('inventory.metrics.outOfStock')}</span>
              </div>
            </div>
          </div>

          {/* Filters Toolbar */}
          <div className="table-toolbar" style={{ gap: '1rem', marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="search-input-wrap" style={{ flexGrow: 1, minWidth: '250px' }}>
              <Search size={16} className="search-input__icon" />
              <input
                type="text"
                className="form-input search-input"
                placeholder={t('common.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%' }}
              />
              {searchQuery && (
                <button className="search-input__clear" onClick={() => setSearchQuery('')}>
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="table-toolbar__filters" style={{ flexGrow: 1, display: 'flex', gap: '0.75rem', justifyContent: 'flex-start', flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Branch Filter dropdown (Owners only) */}
              {!isAdmin && branches.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>{t('common.branch')}:</span>
                  <select
                    className="form-input"
                    value={selectedBranchFilter}
                    onChange={(e) => setSelectedBranchFilter(e.target.value)}
                  >
                    <option value="ALL">{t('common.all')}</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Category Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>{t('inventory.fields.category')}:</span>
                <select
                  className="form-input"
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                >
                  <option value="ALL">{t('common.all')}</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>{t('inventory.fields.status')}:</span>
                <select
                  className="form-input"
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                >
                  <option value="ALL">{t('common.all')}</option>
                  <option value="IN_STOCK">{t('enums.inventoryStatus.IN_STOCK')}</option>
                  <option value="LOW_STOCK">{t('enums.inventoryStatus.LOW_STOCK')}</option>
                  <option value="OUT_OF_STOCK">{t('enums.inventoryStatus.OUT_OF_STOCK')}</option>
                  <option value="DISCONTINUED">{t('enums.inventoryStatus.DISCONTINUED')}</option>
                </select>
              </div>

              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedBranchFilter('ALL');
                  setSelectedCategoryFilter('ALL');
                  setSelectedStatusFilter('ALL');
                }}
                style={{ padding: '0.5rem 1rem' }}
              >
                {t('common.reset')}
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="data-table-wrap">
            {loading ? (
              <div className="loading-state" style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                <Loader2 size={36} className="spinner" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="empty-state" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                <Package size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                <p>{t('inventory.messages.noItems')}</p>
              </div>
            ) : (
              <>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('inventory.fields.name')}</th>
                      <th>{t('inventory.fields.sku')}</th>
                      <th>{t('inventory.fields.category')}</th>
                      <th>{t('inventory.fields.currentQuantity')}</th>
                      <th>{t('inventory.fields.minQuantity')}</th>
                      <th>{t('inventory.fields.unitPrice')}</th>
                      <th>{t('inventory.fields.brand')}</th>
                      <th>{t('inventory.fields.expiryDate')}</th>
                      <th>{t('inventory.fields.status')}</th>
                      {canEdit && <th>{t('common.actions')}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((item) => {
                      const isLow = item.currentQuantity <= item.minQuantity && item.status !== 'OUT_OF_STOCK' && item.status !== 'DISCONTINUED';
                      const isOut = item.currentQuantity === 0 || item.status === 'OUT_OF_STOCK';

                      let statusClass = 'badge--success';
                      if (item.status === 'LOW_STOCK' || isLow) statusClass = 'badge--warning';
                      if (item.status === 'OUT_OF_STOCK' || isOut) statusClass = 'badge--danger';
                      if (item.status === 'DISCONTINUED') statusClass = 'badge--neutral';

                      return (
                        <tr key={item.id}>
                          <td>
                            <div className="cell-primary" style={{ fontWeight: 600 }}>
                              {item.name}
                            </div>
                          </td>
                          <td>
                            <code style={{ backgroundColor: 'var(--bg-light)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '0.8125rem' }}>
                              {item.sku}
                            </code>
                          </td>
                            <td>{item.category?.name || '-'}</td>
                            <td style={{ fontWeight: 600, color: isOut ? 'var(--danger)' : isLow ? 'var(--warning)' : 'inherit' }}>
                              {item.currentQuantity}
                            </td>
                            <td>{item.minQuantity}</td>
                            <td>{formatPrice(item.unitPrice)}</td>
                            <td>{item.brand || '-'}</td>
                            <td>{formatDate(item.expiryDate)}</td>
                            <td>
                              <span className={`badge ${statusClass}`}>
                                {t(`enums.inventoryStatus.${item.status}`)}
                              </span>
                            </td>
                            {canEdit && (
                              <td>
                                <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                                  <button
                                    className="btn btn--icon btn--ghost"
                                    onClick={() => handleOpenEditModal(item)}
                                    title={t('common.edit')}
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                  {canDelete && (
                                    <button
                                      className="btn btn--icon btn--ghost btn--icon-danger"
                                      onClick={() => handleOpenDeleteModal(item)}
                                      title={t('common.delete')}
                                    >
                                      <Trash2 size={16} style={{ color: 'var(--danger)' }} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <Pagination
                    currentPage={currentPage}
                    totalItems={filteredItems.length}
                    pageSize={PAGE_SIZE}
                    onPageChange={setCurrentPage}
                  />
              </>
            )}
          </div>
        </>
      ) : (
        /* Categories Tab */
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          {/* Add Category Button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            {canCreate && (
              <button
                className="btn btn--primary"
                onClick={handleOpenCategoryCreateModal}
              >
                <Plus size={18} />
                <span>{t('inventory.buttons.addCategory')}</span>
              </button>
            )}
          </div>

          {/* Category Toolbar */}
          <div className="table-toolbar" style={{ gap: '1rem', marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="search-input-wrap" style={{ flexGrow: 1, minWidth: '250px' }}>
              <Search size={16} className="search-input__icon" />
              <input
                type="text"
                className="form-input search-input"
                placeholder={t('common.search')}
                value={categorySearchQuery}
                onChange={(e) => setCategorySearchQuery(e.target.value)}
                style={{ width: '100%' }}
              />
              {categorySearchQuery && (
                <button className="search-input__clear" onClick={() => setCategorySearchQuery('')}>
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="table-toolbar__filters" style={{ flexGrow: 1, display: 'flex', gap: '0.75rem', justifyContent: 'flex-start', flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Product Type Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>{t('inventory.fields.productType')}:</span>
                <select
                  className="form-input"
                  value={selectedCategoryProductTypeFilter}
                  onChange={(e) => setSelectedCategoryProductTypeFilter(e.target.value)}
                >
                  <option value="ALL">{t('common.all')}</option>
                  <option value="for_use">{t('enums.productType.for_use')}</option>
                  <option value="for_sale">{t('enums.productType.for_sale')}</option>
                </select>
              </div>

              {/* Status Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>{t('inventory.fields.categoryStatus')}:</span>
                <select
                  className="form-input"
                  value={selectedCategoryStatusFilter}
                  onChange={(e) => setSelectedCategoryStatusFilter(e.target.value)}
                >
                  <option value="ALL">{t('common.all')}</option>
                  <option value="active">{t('enums.categoryStatus.active')}</option>
                  <option value="inactive">{t('enums.categoryStatus.inactive')}</option>
                </select>
              </div>

              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => {
                  setCategorySearchQuery('');
                  setSelectedCategoryStatusFilter('ALL');
                  setSelectedCategoryProductTypeFilter('ALL');
                }}
                style={{ padding: '0.5rem 1rem' }}
              >
                {t('common.reset')}
              </button>
            </div>
          </div>

          {/* Categories List */}
          {loading ? (
            <div className="loading-state" style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <Loader2 size={24} className="spinner" />
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="empty-state" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <Layers size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
              <p>{t('inventory.messages.noCategories')}</p>
            </div>
          ) : (
            <>
              <div className="data-table-wrap" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('inventory.fields.categoryName')}</th>
                      <th>{t('inventory.fields.description')}</th>
                      <th>{t('inventory.fields.productType')}</th>
                      <th>{t('inventory.fields.categoryStatus')}</th>
                      {canEdit && <th>{t('common.actions')}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCategories.map((cat) => (
                      <tr key={cat.id}>
                        <td style={{ fontWeight: 600 }}>{cat.name}</td>
                        <td>{cat.description || '-'}</td>
                        <td>
                          <span className={`badge ${cat.productType === 'for_sale' ? 'badge--info' : 'badge--primary'}`}>
                            {t(`enums.productType.${cat.productType}`, { defaultValue: cat.productType })}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${cat.status === 'active' ? 'badge--success' : 'badge--neutral'}`}>
                            {t(`enums.categoryStatus.${cat.status}`, { defaultValue: cat.status })}
                          </span>
                        </td>
                        {canEdit && (
                          <td>
                            <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                              <button
                                className="btn btn--icon btn--ghost"
                                onClick={() => handleOpenCategoryEditModal(cat)}
                                title={t('common.edit')}
                              >
                                <Edit2 size={16} />
                              </button>
                              {canDelete && (
                                <button
                                  className="btn btn--icon btn--ghost btn--icon-danger"
                                  onClick={() => handleOpenCategoryDeleteModal(cat)}
                                  title={t('common.delete')}
                                >
                                  <Trash2 size={16} style={{ color: 'var(--danger)' }} />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                currentPage={categoryCurrentPage}
                totalItems={filteredCategories.length}
                pageSize={PAGE_SIZE}
                onPageChange={setCategoryCurrentPage}
              />
            </>
          )}
        </div>
      )}

      {/* Item Modal (Create/Edit) */}
      {showItemModal && (
        <div className="modal-overlay" onClick={() => !savingItem && setShowItemModal(false)}>
          <div className="modal" style={{ maxWidth: '750px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <div>
                <h2 className="modal__title">
                  {editingItem ? t('inventory.buttons.editItem') : t('inventory.buttons.addItem')}
                </h2>
              </div>
              <button className="modal__close" onClick={() => !savingItem && setShowItemModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="modal__body">
              {/* Row 1: Item Name & SKU */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">{t('inventory.fields.name')} *</label>
                  <input
                    type="text"
                    className={`form-input ${formErrors.name ? 'form-input--error' : ''}`}
                    placeholder={t('inventory.placeholders.name')}
                    value={itemForm.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    disabled={savingItem}
                    autoFocus
                  />
                  {formErrors.name && (
                    <span className="form-error">
                      <AlertCircle size={12} /> {formErrors.name}
                    </span>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">{t('inventory.fields.sku')} *</label>
                  <input
                    type="text"
                    className={`form-input ${formErrors.sku ? 'form-input--error' : ''}`}
                    placeholder={t('inventory.placeholders.sku')}
                    value={itemForm.sku}
                    onChange={(e) => handleInputChange('sku', e.target.value)}
                    disabled={savingItem}
                  />
                  {formErrors.sku && (
                    <span className="form-error">
                      <AlertCircle size={12} /> {formErrors.sku}
                    </span>
                  )}
                </div>
              </div>

              {/* Row 2: Category & Status */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">{t('inventory.fields.category')} *</label>
                  <select
                    className={`form-input ${formErrors.categoryId ? 'form-input--error' : ''}`}
                    value={itemForm.categoryId}
                    onChange={(e) => handleInputChange('categoryId', e.target.value)}
                    disabled={savingItem}
                  >
                    <option value="" disabled>{t('inventory.placeholders.selectCategory')}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  {formErrors.categoryId && (
                    <span className="form-error">
                      <AlertCircle size={12} /> {formErrors.categoryId}
                    </span>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">{t('inventory.fields.status')} *</label>
                  <select
                    className={`form-input ${formErrors.status ? 'form-input--error' : ''}`}
                    value={itemForm.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    disabled={savingItem}
                  >
                    <option value="IN_STOCK">{t('enums.inventoryStatus.IN_STOCK')}</option>
                    <option value="LOW_STOCK">{t('enums.inventoryStatus.LOW_STOCK')}</option>
                    <option value="OUT_OF_STOCK">{t('enums.inventoryStatus.OUT_OF_STOCK')}</option>
                    <option value="DISCONTINUED">{t('enums.inventoryStatus.DISCONTINUED')}</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Current Quantity, Minimum Quantity & Unit Price */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">{t('inventory.fields.currentQuantity')} *</label>
                  <input
                    type="number"
                    className="form-input"
                    value={itemForm.currentQuantity}
                    onChange={(e) => handleInputChange('currentQuantity', Number(e.target.value))}
                    disabled={savingItem}
                    min={0}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('inventory.fields.minQuantity')} *</label>
                  <input
                    type="number"
                    className="form-input"
                    value={itemForm.minQuantity}
                    onChange={(e) => handleInputChange('minQuantity', Number(e.target.value))}
                    disabled={savingItem}
                    min={0}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('inventory.fields.unitPrice')} *</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.875rem', color: 'var(--text-muted)' }}>MXN</span>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      style={{ paddingLeft: '3rem' }}
                      value={itemForm.unitPrice}
                      onChange={(e) => handleInputChange('unitPrice', Number(e.target.value))}
                      disabled={savingItem}
                      min={0}
                    />
                  </div>
                </div>
              </div>

              {/* Row 4: Brand, Supplier & Expiry Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">{t('inventory.fields.brand')}</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder={t('inventory.placeholders.brand')}
                    value={itemForm.brand}
                    onChange={(e) => handleInputChange('brand', e.target.value)}
                    disabled={savingItem}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('inventory.fields.supplier')}</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder={t('inventory.placeholders.supplier')}
                    value={itemForm.supplier}
                    onChange={(e) => handleInputChange('supplier', e.target.value)}
                    disabled={savingItem}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('inventory.fields.expiryDate')}</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="date"
                      className="form-input"
                      value={itemForm.expiryDate}
                      onChange={(e) => handleInputChange('expiryDate', e.target.value)}
                      disabled={savingItem}
                    />
                  </div>
                </div>
              </div>

              {/* Owner only: Branch Select */}
              {!isAdmin && branches.length > 0 && (
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">{t('inventory.fields.branch')}</label>
                  <select
                    className="form-input"
                    value={itemForm.branchId}
                    onChange={(e) => handleInputChange('branchId', e.target.value)}
                    disabled={savingItem}
                  >
                    <option value="">{t('common.allBranches')}</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Row 5: Description */}
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">{t('inventory.fields.description')}</label>
                <textarea
                  className="form-input"
                  style={{ minHeight: '80px', fontFamily: 'inherit', padding: '10px 14px' }}
                  placeholder={t('inventory.placeholders.description')}
                  value={itemForm.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  disabled={savingItem}
                />
              </div>

              {/* Footer */}
              <div className="modal__footer">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setShowItemModal(false)}
                  disabled={savingItem}
                >
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn--primary" disabled={savingItem}>
                  {savingItem ? (
                    <>
                      <Loader2 size={16} className="spinner" />
                      <span>{t('common.saving')}</span>
                    </>
                  ) : (
                    <span>{editingItem ? t('inventory.buttons.updateItem') : t('inventory.buttons.createItem')}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Item Confirm Modal */}
      {showDeleteModal && itemToDelete && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2 className="modal__title">{t('inventory.buttons.deleteItem')}</h2>
              <button className="modal__close" onClick={() => setShowDeleteModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal__body" style={{ padding: '1rem 1.75rem' }}>
              <p style={{ margin: 0, color: 'var(--text-primary)' }}>
                {t('inventory.messages.confirmDelete')}
                <br />
                <strong style={{ color: 'var(--danger)' }}>{itemToDelete.name} ({itemToDelete.sku})</strong>
              </p>
            </div>
            <div className="modal__footer" style={{ padding: '1rem 1.75rem' }}>
              <button className="btn btn--ghost" onClick={() => setShowDeleteModal(false)}>
                {t('common.cancel')}
              </button>
              <button className="btn btn--danger" onClick={handleConfirmDelete}>
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Category Confirm Modal */}
      {showCategoryDeleteModal && categoryToDelete && (
        <div className="modal-overlay" onClick={() => setShowCategoryDeleteModal(false)}>
          <div className="modal" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2 className="modal__title">{t('common.delete')}</h2>
              <button className="modal__close" onClick={() => setShowCategoryDeleteModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal__body" style={{ padding: '1rem 1.75rem' }}>
              <p style={{ margin: 0, color: 'var(--text-primary)' }}>
                {t('inventory.messages.confirmDeleteCategory')}
                <br />
                <strong style={{ color: 'var(--danger)' }}>{categoryToDelete.name}</strong>
              </p>
            </div>
            <div className="modal__footer" style={{ padding: '1rem 1.75rem' }}>
              <button className="btn btn--ghost" onClick={() => setShowCategoryDeleteModal(false)}>
                {t('common.cancel')}
              </button>
              <button className="btn btn--danger" onClick={handleConfirmCategoryDelete}>
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category In Use Warning Modal */}
      {showCategoryInUseModal && (
        <div className="modal-overlay" onClick={() => setShowCategoryInUseModal(false)}>
          <div className="modal" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2 className="modal__title" style={{ color: 'var(--warning)' }}>{t('common.warning')}</h2>
              <button className="modal__close" onClick={() => setShowCategoryInUseModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal__body" style={{ padding: '1rem 1.75rem' }}>
              <p style={{ margin: 0, color: 'var(--text-primary)' }}>
                {t('inventory.messages.categoryDeleteError')}
              </p>
            </div>
            <div className="modal__footer" style={{ padding: '1rem 1.75rem' }}>
              <button className="btn btn--primary" onClick={() => setShowCategoryInUseModal(false)}>
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Category Modal */}
      {showCategoryModal && (
        <div className="modal-overlay" onClick={() => !categorySaving && setShowCategoryModal(false)}>
          <div className="modal" style={{ maxWidth: '500px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h2 className="modal__title">
                {editingCategory ? t('common.edit') : t('inventory.buttons.addCategory')}
              </h2>
              <button className="modal__close" onClick={() => !categorySaving && setShowCategoryModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveCategory} className="modal__body">
              {/* Name */}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">{t('inventory.fields.categoryName')} *</label>
                <input
                  type="text"
                  className="form-input"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                  disabled={categorySaving}
                  placeholder={t('inventory.placeholders.categoryName')}
                  autoFocus
                  required
                />
              </div>

              {/* Status & Product Type */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">{t('inventory.fields.productType')} *</label>
                  <select
                    className="form-input"
                    value={categoryForm.productType}
                    onChange={(e) => setCategoryForm(prev => ({ ...prev, productType: e.target.value }))}
                    disabled={categorySaving}
                  >
                    <option value="for_use">{t('enums.productType.for_use')}</option>
                    <option value="for_sale">{t('enums.productType.for_sale')}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('inventory.fields.categoryStatus')} *</label>
                  <select
                    className="form-input"
                    value={categoryForm.status}
                    onChange={(e) => setCategoryForm(prev => ({ ...prev, status: e.target.value }))}
                    disabled={categorySaving}
                  >
                    <option value="active">{t('enums.categoryStatus.active')}</option>
                    <option value="inactive">{t('enums.categoryStatus.inactive')}</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">{t('inventory.fields.categoryDescription')}</label>
                <textarea
                  className="form-input"
                  style={{ minHeight: '80px', fontFamily: 'inherit', padding: '10px 14px' }}
                  placeholder={t('inventory.placeholders.categoryDescription')}
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, description: e.target.value }))}
                  disabled={categorySaving}
                />
              </div>

              <div className="modal__footer">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setShowCategoryModal(false)}
                  disabled={categorySaving}
                >
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn--primary" disabled={categorySaving || !categoryForm.name.trim()}>
                  {categorySaving ? (
                    <>
                      <Loader2 size={16} className="spinner" />
                      <span>{t('common.saving')}</span>
                    </>
                  ) : (
                    <span>{t('common.save')}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
