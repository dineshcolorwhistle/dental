import { useAuth } from '../context';
import {
  Activity,
  Users,
  Building2,
  ClipboardList,
} from 'lucide-react';

const ROLE_GREETINGS: Record<string, string> = {
  SUPER_ADMIN: 'Platform Overview',
  OWNER: 'Lab Overview',
  ADMIN: 'Branch Overview',
  TECHNICIAN: 'My Queue',
  DELIVERY: 'My Deliveries',
  DOCTOR: 'Doctor Portal',
};

export function DashboardPage() {
  const { user } = useAuth();

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-page__header">
        <div>
          <h1 className="dashboard-page__title">
            {greeting()}, {user?.firstName}!
          </h1>
          <p className="dashboard-page__subtitle">
            {ROLE_GREETINGS[user?.role ?? ''] ?? 'Dashboard'}
          </p>
        </div>
      </div>

      <div className="dashboard-page__stats">
        <div className="stat-card">
          <div className="stat-card__icon stat-card__icon--primary">
            <Activity size={24} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">0</span>
            <span className="stat-card__label">Active Orders</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card__icon stat-card__icon--success">
            <Users size={24} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">0</span>
            <span className="stat-card__label">Total Users</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card__icon stat-card__icon--warning">
            <Building2 size={24} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">0</span>
            <span className="stat-card__label">Branches</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card__icon stat-card__icon--info">
            <ClipboardList size={24} />
          </div>
          <div className="stat-card__content">
            <span className="stat-card__value">0</span>
            <span className="stat-card__label">Completed Today</span>
          </div>
        </div>
      </div>

      <div className="dashboard-page__content">
        <div className="dashboard-card">
          <h3 className="dashboard-card__title">Getting Started</h3>
          <p className="dashboard-card__text">
            Welcome to the Dental Lab Management System. This platform will help you manage 
            your dental lab's entire workflow — from work order intake to delivery.
          </p>
          <div className="dashboard-card__steps">
            <div className="step">
              <div className="step__number">1</div>
              <div className="step__content">
                <strong>Set up your lab</strong>
                <p>Create tenants and branches to organize your operations.</p>
              </div>
            </div>
            <div className="step">
              <div className="step__number">2</div>
              <div className="step__content">
                <strong>Add your team</strong>
                <p>Invite administrators, technicians, and delivery personnel.</p>
              </div>
            </div>
            <div className="step">
              <div className="step__number">3</div>
              <div className="step__content">
                <strong>Configure workflows</strong>
                <p>Define work types, processes, and workflow templates.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
