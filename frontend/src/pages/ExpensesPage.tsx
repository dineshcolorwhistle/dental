import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  Search,
  X,
  Loader2,
  Trash2,
  Edit2,
  DollarSign,
  Layers,
  TrendingDown,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  expenseService,
  type Expense,
  type ExpenseCategory,
} from '../services';
import { Pagination, DateRangePicker } from '../components';

const PAGE_SIZE = 10;
type ActiveTab = 'EXPENSES' | 'CATEGORIES';

export function ExpensesPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const canDelete = user?.role === 'OWNER' || user?.role === 'SUPER_ADMIN';

  // State
  const [activeTab, setActiveTab] = useState<ActiveTab>('EXPENSES');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');
  const [datePreset, setDatePreset] = useState<string>('thisMonth');
  
  const getInitialThisMonthRange = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const fmt = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    return {
      start: fmt(firstDay),
      end: fmt(lastDay)
    };
  };

  const initialRange = getInitialThisMonthRange();
  const [startDateFilter, setStartDateFilter] = useState<string>(initialRange.start);
  const [endDateFilter, setEndDateFilter] = useState<string>(initialRange.end);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(0);

  // Category search & pagination
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [categoryCurrentPage, setCategoryCurrentPage] = useState(0);

  // Category Form Modal State
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
  });

  // Expense Form State (matches screenshot)
  const [savingExpense, setSavingExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    date: new Date().toISOString().split('T')[0],
    title: '',
    categoryId: '',
    description: '',
    amount: '',
    paymentMethod: 'BBVA Crédito',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Delete Modals State
  const [showDeleteExpenseModal, setShowDeleteExpenseModal] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState(false);

  const [showDeleteCategoryModal, setShowDeleteCategoryModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<ExpenseCategory | null>(null);
  const [deletingCategory, setDeletingCategory] = useState(false);

  const [showCategoryInUseModal, setShowCategoryInUseModal] = useState(false);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [expensesData, categoriesData] = await Promise.all([
        expenseService.getAllExpenses(),
        expenseService.getCategories(),
      ]);
      setExpenses(expensesData);
      setCategories(categoriesData);
    } catch (err) {
      toast.error(t('common.failedLoadReference'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset pagination on filter changes
  useEffect(() => {
    setCurrentPage(0);
  }, [searchQuery, selectedCategoryFilter, startDateFilter, endDateFilter, datePreset]);

  useEffect(() => {
    setCategoryCurrentPage(0);
  }, [categorySearchQuery]);

  // Format price helper
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat(i18n.language?.startsWith('es') ? 'es-MX' : 'en-US', {
      style: 'currency',
      currency: i18n.language?.startsWith('es') ? 'MXN' : 'USD',
    }).format(price);
  };

  // Format date helper
  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString(
      i18n.language?.startsWith('es') ? 'es-MX' : 'en-US',
      { day: 'numeric', month: 'long', year: 'numeric' }
    );
  };

  // Open create expense view
  const handleOpenCreateExpense = () => {
    setEditingExpense(null);
    setExpenseForm({
      date: new Date().toISOString().split('T')[0],
      title: '',
      categoryId: categories[0]?.id || '',
      description: '',
      amount: '',
      paymentMethod: 'BBVA Crédito',
    });
    setFormErrors({});
    setShowExpenseModal(true);
  };

  // Open edit expense view
  const handleOpenEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setExpenseForm({
      date: new Date(expense.date).toISOString().split('T')[0],
      title: expense.title,
      categoryId: expense.categoryId,
      description: expense.description || '',
      amount: expense.amount.toString(),
      paymentMethod: expense.paymentMethod,
    });
    setFormErrors({});
    setShowExpenseModal(true);
  };

  // Validate expense form
  const validateExpenseForm = () => {
    const errors: Record<string, string> = {};
    if (!expenseForm.date) errors.date = t('validation.required', { defaultValue: 'Required' });
    if (!expenseForm.title.trim()) errors.title = t('validation.required', { defaultValue: 'Required' });
    if (!expenseForm.categoryId) errors.categoryId = t('validation.required', { defaultValue: 'Required' });
    if (!expenseForm.amount || parseFloat(expenseForm.amount) <= 0) errors.amount = t('validation.required', { defaultValue: 'Required' });
    if (!expenseForm.paymentMethod) errors.paymentMethod = t('validation.required', { defaultValue: 'Required' });

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save Expense
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateExpenseForm()) return;

    try {
      setSavingExpense(true);
      const payload = {
        title: expenseForm.title.trim(),
        description: expenseForm.description.trim() || undefined,
        amount: parseFloat(expenseForm.amount),
        date: new Date(expenseForm.date).toISOString(),
        paymentMethod: expenseForm.paymentMethod,
        categoryId: expenseForm.categoryId,
      };

      if (editingExpense) {
        await expenseService.updateExpense(editingExpense.id, payload);
        toast.success(t('expenses.messages.updateSuccess'));
      } else {
        await expenseService.createExpense(payload);
        toast.success(t('expenses.messages.createSuccess'));
      }

      setShowExpenseModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('common.failedLoadReference'));
    } finally {
      setSavingExpense(false);
    }
  };

  // Open create category modal
  const handleOpenCategoryCreateModal = () => {
    setEditingCategory(null);
    setCategoryForm({ name: '', description: '' });
    setShowCategoryModal(true);
  };

  // Open edit category modal
  const handleOpenCategoryEditModal = (category: ExpenseCategory) => {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      description: category.description || '',
    });
    setShowCategoryModal(true);
  };

  // Save Category
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) return;

    try {
      setCategorySaving(true);
      const payload = {
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim() || undefined,
      };

      if (editingCategory) {
        await expenseService.updateCategory(editingCategory.id, payload);
        toast.success(t('expenses.messages.categoryUpdateSuccess'));
      } else {
        await expenseService.createCategory(payload);
        toast.success(t('expenses.messages.categoryCreateSuccess'));
      }

      setShowCategoryModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('common.failedLoadReference'));
    } finally {
      setCategorySaving(false);
    }
  };

  // Open Delete Expense Modal
  const handleOpenDeleteExpense = (expense: Expense) => {
    setExpenseToDelete(expense);
    setShowDeleteExpenseModal(true);
  };

  // Confirm Delete Expense
  const handleConfirmDeleteExpense = async () => {
    if (!expenseToDelete) return;
    try {
      setDeletingExpense(true);
      await expenseService.deleteExpense(expenseToDelete.id);
      toast.success(t('expenses.messages.deleteSuccess'));
      setShowDeleteExpenseModal(false);
      setExpenseToDelete(null);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('common.failedLoadReference'));
    } finally {
      setDeletingExpense(false);
    }
  };

  // Open Delete Category Modal
  const handleOpenDeleteCategory = (category: ExpenseCategory) => {
    // Check if category is assigned to any expenses
    const isAssigned = expenses.some((exp) => exp.categoryId === category.id);
    if (isAssigned) {
      setShowCategoryInUseModal(true);
      return;
    }
    setCategoryToDelete(category);
    setShowDeleteCategoryModal(true);
  };

  // Confirm Delete Category
  const handleConfirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    try {
      setDeletingCategory(true);
      await expenseService.deleteCategory(categoryToDelete.id);
      toast.success(t('expenses.messages.categoryDeleteSuccess'));
      setShowDeleteCategoryModal(false);
      setCategoryToDelete(null);
      fetchData();
    } catch (err: any) {
      setShowCategoryInUseModal(true);
    } finally {
      setDeletingCategory(false);
    }
  };

  // Filter logic
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      const matchesSearch =
        exp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (exp.description && exp.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        exp.paymentMethod.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        selectedCategoryFilter === 'ALL' || exp.categoryId === selectedCategoryFilter;

      const expDate = new Date(exp.date);
      
      const parseLocalDate = (dateStr: string, isEnd: boolean) => {
        if (!dateStr) return null;
        const [year, month, day] = dateStr.split('-').map(Number);
        return isEnd ? new Date(year, month - 1, day, 23, 59, 59, 999) : new Date(year, month - 1, day, 0, 0, 0, 0);
      };

      const start = parseLocalDate(startDateFilter, false);
      const end = parseLocalDate(endDateFilter, true);

      const matchesStartDate = !start || expDate >= start;
      const matchesEndDate = !end || expDate <= end;
      const matchesDateRange = matchesStartDate && matchesEndDate;

      return matchesSearch && matchesCategory && matchesDateRange;
    });
  }, [expenses, searchQuery, selectedCategoryFilter, startDateFilter, endDateFilter]);

  const totalAmount = useMemo(() => {
    return filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  }, [filteredExpenses]);

  const averageAmount = useMemo(() => {
    if (filteredExpenses.length === 0) return 0;
    return totalAmount / filteredExpenses.length;
  }, [filteredExpenses, totalAmount]);

  const paginatedExpenses = useMemo(() => {
    const start = currentPage * PAGE_SIZE;
    return filteredExpenses.slice(start, start + PAGE_SIZE);
  }, [filteredExpenses, currentPage]);

  const filteredCategories = useMemo(() => {
    return categories.filter((cat) => {
      if (!categorySearchQuery) return true;
      const query = categorySearchQuery.toLowerCase();
      return (
        cat.name.toLowerCase().includes(query) ||
        (cat.description && cat.description.toLowerCase().includes(query))
      );
    });
  }, [categories, categorySearchQuery]);

  const paginatedCategories = useMemo(() => {
    const start = categoryCurrentPage * PAGE_SIZE;
    return filteredCategories.slice(start, start + PAGE_SIZE);
  }, [filteredCategories, categoryCurrentPage]);

  return (
    <div className="page-container" style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {t('expenses.title')}
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {t('expenses.subtitle')}
          </p>
        </div>

        <div className="tab-navigation" style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'var(--bg-light)', padding: '0.25rem', borderRadius: '8px' }}>
          <button
            className={`btn ${activeTab === 'EXPENSES' ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => setActiveTab('EXPENSES')}
            style={{ padding: '0.5rem 1rem', borderRadius: '6px' }}
          >
            <DollarSign size={16} style={{ marginRight: '0.5rem' }} />
            {t('expenses.expensesTab')}
          </button>
          <button
            className={`btn ${activeTab === 'CATEGORIES' ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => setActiveTab('CATEGORIES')}
            style={{ padding: '0.5rem 1rem', borderRadius: '6px' }}
          >
            <Layers size={16} style={{ marginRight: '0.5rem' }} />
            {t('expenses.categoriesTab')}
          </button>
        </div>
      </header>

      {/* EXPENSES TAB */}
      {activeTab === 'EXPENSES' && (
        <div>
          {/* Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <button className="btn btn--primary" onClick={handleOpenCreateExpense}>
              <Plus size={18} />
              <span>{t('expenses.addExpense')}</span>
            </button>
          </div>

          {/* Filters toolbar */}
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

            <div className="table-toolbar__filters" style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              {/* Category Filter */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 600 }}>{t('expenses.fields.category')}:</span>
                <select
                  className="form-input"
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  style={{ height: '38px', borderRadius: '8px', minWidth: '150px' }}
                >
                  <option value="ALL">{t('common.all')}</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {/* Date Range Picker */}
              <DateRangePicker
                startDate={startDateFilter}
                endDate={endDateFilter}
                presetType={datePreset}
                onChange={(start, end, preset) => {
                  setStartDateFilter(start);
                  setEndDateFilter(end);
                  setDatePreset(preset);
                }}
              />

              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => {
                  setSelectedCategoryFilter('ALL');
                  const range = getInitialThisMonthRange();
                  setStartDateFilter(range.start);
                  setEndDateFilter(range.end);
                  setDatePreset('thisMonth');
                  setSearchQuery('');
                }}
                style={{ height: '38px', padding: '0 1.25rem', borderRadius: '8px' }}
              >
                {t('common.reset')}
              </button>
            </div>
          </div>

          {/* KPI Widgets Grid - Placed BELOW the filter section */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
            {/* Card: Total Expenses */}
            <div style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '1.25rem',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--danger)',
              }}>
                <DollarSign size={24} />
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('expenses.totalExpenses')}
                </span>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-heading)', margin: '2px 0 0 0' }}>
                  {formatPrice(totalAmount)}
                </h3>
              </div>
            </div>

            {/* Card: Average Expense */}
            <div style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '1.25rem',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)',
              }}>
                <TrendingDown size={24} />
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('expenses.averageExpense')}
                </span>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-heading)', margin: '2px 0 0 0' }}>
                  {formatPrice(averageAmount)}
                </h3>
              </div>
            </div>

            {/* Card: Expense Count */}
            <div style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '1.25rem',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--success)',
              }}>
                <Layers size={24} />
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('expenses.expenseCount')}
                </span>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-heading)', margin: '2px 0 0 0' }}>
                  {filteredExpenses.length}
                </h3>
              </div>
            </div>
          </div>

          {/* Data Table */}
          <div className="data-table-wrap" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
            {loading ? (
              <div className="loading-state" style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                <Loader2 size={36} className="spinner" />
              </div>
            ) : filteredExpenses.length === 0 ? (
              <div className="empty-state" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                <DollarSign size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                <p>{t('expenses.messages.noExpenses')}</p>
              </div>
            ) : (
              <>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('expenses.fields.date')}</th>
                      <th>{t('expenses.fields.title')}</th>
                      <th>{t('expenses.fields.category')}</th>
                      <th>{t('expenses.fields.amount')}</th>
                      <th>{t('expenses.fields.paymentMethod')}</th>
                      <th>{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedExpenses.map((exp) => (
                      <tr key={exp.id}>
                        <td style={{ fontWeight: 500 }}>{formatDate(exp.date)}</td>
                        <td>
                          <div className="cell-primary" style={{ fontWeight: 600 }}>{exp.title}</div>
                          {exp.description && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{exp.description}</div>}
                        </td>
                        <td>
                          <span className="badge badge--neutral" style={{ fontWeight: 500 }}>{exp.category?.name}</span>
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatPrice(exp.amount)}</td>
                        <td>{exp.paymentMethod}</td>
                        <td>
                          <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                            <button
                              className="btn btn--icon btn--ghost"
                              onClick={() => handleOpenEditExpense(exp)}
                              title={t('common.edit')}
                            >
                              <Edit2 size={16} />
                            </button>
                            {canDelete && (
                              <button
                                className="btn btn--icon btn--ghost btn--icon-danger"
                                onClick={() => handleOpenDeleteExpense(exp)}
                                title={t('common.delete')}
                              >
                                <Trash2 size={16} style={{ color: 'var(--danger)' }} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination
                  currentPage={currentPage}
                  totalItems={filteredExpenses.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setCurrentPage}
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* CATEGORIES TAB */}
      {activeTab === 'CATEGORIES' && (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <button className="btn btn--primary" onClick={handleOpenCategoryCreateModal}>
              <Plus size={18} />
              <span>{t('expenses.addCategory')}</span>
            </button>
          </div>

          {/* Category Toolbar */}
          <div className="table-toolbar" style={{ gap: '1rem', marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="search-input-wrap" style={{ flexGrow: 1 }}>
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
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => setCategorySearchQuery('')}
              style={{ padding: '0.5rem 1rem' }}
            >
              {t('common.reset')}
            </button>
          </div>

          {/* Categories Grid Table UI */}
          <div>
            {loading ? (
              <div className="loading-state" style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                <Loader2 size={36} className="spinner" />
              </div>
            ) : filteredCategories.length === 0 ? (
              <div className="empty-state" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                <Layers size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                <p>{t('expenses.messages.noCategories')}</p>
              </div>
            ) : (
              <>
                <div className="data-table-wrap" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{t('expenses.fields.categoryName')}</th>
                        <th>{t('expenses.fields.categoryDescription')}</th>
                        <th>{t('common.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedCategories.map((cat) => (
                        <tr key={cat.id}>
                          <td style={{ fontWeight: 600 }}>{cat.name}</td>
                          <td>{cat.description || '-'}</td>
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
                                  onClick={() => handleOpenDeleteCategory(cat)}
                                  title={t('common.delete')}
                                >
                                  <Trash2 size={16} style={{ color: 'var(--danger)' }} />
                                </button>
                              )}
                            </div>
                          </td>
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
        </div>
      )}

      {/* EXPENSE FORM MODAL OVERLAY */}
      {showExpenseModal && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, padding: '1rem' }}>
          <div className="modal" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '800px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {editingExpense ? t('expenses.editExpense') : t('expenses.addExpense')}
              </h3>
              <button className="btn btn--icon btn--ghost" onClick={() => setShowExpenseModal(false)} style={{ padding: 0 }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Row 1: Date, Title, Category */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'block' }}>
                    {t('expenses.fields.date')} *
                  </label>
                  <input
                    type="date"
                    className={`form-input ${formErrors.date ? 'form-input--error' : ''}`}
                    value={expenseForm.date}
                    onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                    required
                    style={{ width: '100%' }}
                  />
                  {formErrors.date && <span className="form-error">{formErrors.date}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'block' }}>
                    {t('expenses.fields.title')} *
                  </label>
                  <input
                    type="text"
                    className={`form-input ${formErrors.title ? 'form-input--error' : ''}`}
                    placeholder={t('expenses.placeholders.enterTitle')}
                    value={expenseForm.title}
                    onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                    required
                    style={{ width: '100%' }}
                  />
                  {formErrors.title && <span className="form-error">{formErrors.title}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'block' }}>
                    {t('expenses.fields.category')} *
                  </label>
                  <select
                    className={`form-input ${formErrors.categoryId ? 'form-input--error' : ''}`}
                    value={expenseForm.categoryId}
                    onChange={(e) => setExpenseForm({ ...expenseForm, categoryId: e.target.value })}
                    required
                    style={{ width: '100%' }}
                  >
                    <option value="">{t('expenses.placeholders.selectCategory')}</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  {formErrors.categoryId && <span className="form-error">{formErrors.categoryId}</span>}
                </div>
              </div>

              {/* Description Textarea */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'block' }}>
                  {t('expenses.fields.description')}
                </label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder={t('expenses.placeholders.enterDescription')}
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              {/* Row 3: Amount, Payment Method */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'block' }}>
                    {t('expenses.fields.amount')} *
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <span style={{ position: 'absolute', left: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.875rem' }}>
                      MXN
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className={`form-input ${formErrors.amount ? 'form-input--error' : ''}`}
                      placeholder={t('expenses.placeholders.enterAmount')}
                      value={expenseForm.amount}
                      onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                      required
                      style={{ width: '100%', paddingLeft: '3.5rem' }}
                    />
                  </div>
                  {formErrors.amount && <span className="form-error">{formErrors.amount}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'block' }}>
                    {t('expenses.fields.paymentMethod')} *
                  </label>
                  <select
                    className={`form-input ${formErrors.paymentMethod ? 'form-input--error' : ''}`}
                    value={expenseForm.paymentMethod}
                    onChange={(e) => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value })}
                    required
                    style={{ width: '100%' }}
                  >
                    <option value="BBVA Crédito">BBVA Crédito</option>
                    <option value="Efectivo">{i18n.language?.startsWith('es') ? 'Efectivo' : 'Cash'}</option>
                    <option value="Transferencia">{i18n.language?.startsWith('es') ? 'Transferencia' : 'Wire Transfer'}</option>
                    <option value="Tarjeta de Débito">{i18n.language?.startsWith('es') ? 'Tarjeta de Débito' : 'Debit Card'}</option>
                    <option value="Tarjeta de Crédito">{i18n.language?.startsWith('es') ? 'Tarjeta de Crédito' : 'Credit Card'}</option>
                  </select>
                  {formErrors.paymentMethod && <span className="form-error">{formErrors.paymentMethod}</span>}
                </div>
              </div>

              {/* Form Buttons */}
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" className="btn btn--secondary" onClick={() => setShowExpenseModal(false)}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn--primary" disabled={savingExpense}>
                  {savingExpense ? <Loader2 size={16} className="spinner" /> : null}
                  <span>{editingExpense ? t('common.saveChanges') : t('common.submit')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CATEGORY FORM MODAL */}
      {showCategoryModal && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, padding: '1rem' }}>
          <div className="modal" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>
                {editingCategory ? t('expenses.editCategory') : t('expenses.addCategory')}
              </h3>
              <button className="btn btn--icon btn--ghost" onClick={() => setShowCategoryModal(false)} style={{ padding: 0 }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'block' }}>
                  {t('expenses.fields.categoryName')} *
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder={t('expenses.placeholders.enterCategoryName')}
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  required
                  style={{ width: '100%' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'block' }}>
                  {t('expenses.fields.categoryDescription')}
                </label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder={t('expenses.placeholders.enterCategoryDescription')}
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  style={{ width: '100%', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" className="btn btn--secondary" onClick={() => setShowCategoryModal(false)}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn--primary" disabled={categorySaving || !categoryForm.name.trim()}>
                  {categorySaving ? <Loader2 size={16} className="spinner" /> : null}
                  <span>{editingCategory ? t('common.saveChanges') : t('common.submit')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Expense Confirm Modal */}
      {showDeleteExpenseModal && expenseToDelete && (
        <div className="modal-overlay" onClick={() => !deletingExpense && setShowDeleteExpenseModal(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, padding: '1rem' }}>
          <div className="modal" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 className="modal__title" style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>{t('common.delete')}</h2>
              <button className="modal__close" onClick={() => !deletingExpense && setShowDeleteExpenseModal(false)} style={{ padding: 0, background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <div className="modal__body" style={{ padding: '0 0 1.5rem 0', overflow: 'visible' }}>
              <p style={{ margin: 0, color: 'var(--text-primary)' }}>
                {t('expenses.messages.confirmDelete')}
                <br />
                <strong style={{ color: 'var(--danger)' }}>{expenseToDelete.title}</strong>
              </p>
            </div>
            <div className="modal__footer" style={{ padding: 0, border: 'none', marginTop: 0 }}>
              <button className="btn btn--ghost" onClick={() => setShowDeleteExpenseModal(false)} disabled={deletingExpense} style={{ marginRight: '0.75rem' }}>
                {t('common.cancel')}
              </button>
              <button className="btn btn--danger" onClick={handleConfirmDeleteExpense} disabled={deletingExpense}>
                {deletingExpense ? <Loader2 size={16} className="spinner" style={{ marginRight: '0.5rem' }} /> : <Trash2 size={16} style={{ marginRight: '0.5rem' }} />}
                <span>{t('common.delete')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Category Confirm Modal */}
      {showDeleteCategoryModal && categoryToDelete && (
        <div className="modal-overlay" onClick={() => !deletingCategory && setShowDeleteCategoryModal(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, padding: '1rem' }}>
          <div className="modal" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 className="modal__title" style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>{t('common.delete')}</h2>
              <button className="modal__close" onClick={() => !deletingCategory && setShowDeleteCategoryModal(false)} style={{ padding: 0, background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <div className="modal__body" style={{ padding: '0 0 1.5rem 0', overflow: 'visible' }}>
              <p style={{ margin: 0, color: 'var(--text-primary)' }}>
                {t('expenses.messages.confirmDeleteCategory')}
                <br />
                <strong style={{ color: 'var(--danger)' }}>{categoryToDelete.name}</strong>
              </p>
            </div>
            <div className="modal__footer" style={{ padding: 0, border: 'none', marginTop: 0 }}>
              <button className="btn btn--ghost" onClick={() => setShowDeleteCategoryModal(false)} disabled={deletingCategory} style={{ marginRight: '0.75rem' }}>
                {t('common.cancel')}
              </button>
              <button className="btn btn--danger" onClick={handleConfirmDeleteCategory} disabled={deletingCategory}>
                {deletingCategory ? <Loader2 size={16} className="spinner" style={{ marginRight: '0.5rem' }} /> : <Trash2 size={16} style={{ marginRight: '0.5rem' }} />}
                <span>{t('common.delete')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category In Use Warning Modal */}
      {showCategoryInUseModal && (
        <div className="modal-overlay" onClick={() => setShowCategoryInUseModal(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, padding: '1rem' }}>
          <div className="modal" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 className="modal__title" style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--warning)' }}>{t('common.warning')}</h2>
              <button className="modal__close" onClick={() => setShowCategoryInUseModal(false)} style={{ padding: 0, background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <div className="modal__body" style={{ padding: '0 0 1.5rem 0', overflow: 'visible' }}>
              <p style={{ margin: 0, color: 'var(--text-primary)' }}>
                {t('expenses.messages.categoryDeleteError')}
              </p>
            </div>
            <div className="modal__footer" style={{ padding: 0, border: 'none', marginTop: 0 }}>
              <button className="btn btn--primary" onClick={() => setShowCategoryInUseModal(false)}>
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
