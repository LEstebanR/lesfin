import { Ionicons } from '@expo/vector-icons'
import { StatusBar } from 'expo-status-bar'
import { useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

type Tab = 'home' | 'transactions' | 'accounts' | 'budget' | 'more'
type Kind = 'expense' | 'income'
type IconName = keyof typeof Ionicons.glyphMap

type Transaction = {
  id: string
  title: string
  category: string
  amount: number
  kind: Kind
  date: string
  icon: IconName
  color: string
}

type Account = {
  name: string
  type: string
  balance: number
  color: string
  icon: IconName
}

const C = {
  bg: '#F8F9F5',
  card: '#FFFFFF',
  text: '#1D2530',
  muted: '#7A818A',
  border: '#E8EBE5',
  green: '#B5E44A',
  greenDark: '#8DBA24',
  navy: '#1D2530',
  red: '#D95C5C',
  blue: '#5D91D9',
  purple: '#9574D1',
  orange: '#E7A14D',
}

const initialAccounts: Account[] = [
  {
    name: 'Efectivo',
    type: 'Cash',
    balance: 1250000,
    color: C.greenDark,
    icon: 'wallet-outline',
  },
  {
    name: 'Ahorros',
    type: 'Savings',
    balance: 4850000,
    color: C.blue,
    icon: 'trending-up-outline',
  },
  {
    name: 'Caja menor',
    type: 'Caja',
    balance: 320000,
    color: C.orange,
    icon: 'lock-closed-outline',
  },
]

const initialTransactions: Transaction[] = [
  {
    id: '1',
    title: 'Mercado semanal',
    category: 'Alimentación',
    amount: 186500,
    kind: 'expense',
    date: 'Hoy, 10:42',
    icon: 'cart-outline',
    color: C.orange,
  },
  {
    id: '2',
    title: 'Pago mensual',
    category: 'Salario',
    amount: 5200000,
    kind: 'income',
    date: 'Ayer, 08:00',
    icon: 'briefcase-outline',
    color: C.greenDark,
  },
  {
    id: '3',
    title: 'Plan de streaming',
    category: 'Suscripciones',
    amount: 34900,
    kind: 'expense',
    date: '28 Feb, 14:20',
    icon: 'play-circle-outline',
    color: C.purple,
  },
  {
    id: '4',
    title: 'Transporte',
    category: 'Movilidad',
    amount: 42000,
    kind: 'expense',
    date: '27 Feb, 18:12',
    icon: 'car-outline',
    color: C.blue,
  },
]

const money = (value: number) =>
  `$${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(value)}`

function Icon({
  name,
  color = C.text,
  size = 21,
}: {
  name: IconName
  color?: string
  size?: number
}) {
  return <Ionicons color={color} name={name} size={size} />
}

function Header({
  title,
  onProfile,
}: {
  title: string
  onProfile: () => void
}) {
  return (
    <View style={styles.header}>
      <Text style={styles.logo}>lesfin</Text>
      <View style={styles.headerRight}>
        <Pressable style={styles.bell}>
          <Icon name="notifications-outline" size={20} />
          <View style={styles.dot} />
        </Pressable>
        <Text style={styles.headerTitle}>{title}</Text>
        <Pressable style={styles.avatar} onPress={onProfile}>
          <Text style={styles.avatarText}>L</Text>
        </Pressable>
      </View>
    </View>
  )
}

function SectionTitle({
  title,
  action,
  onPress,
}: {
  title: string
  action?: string
  onPress?: () => void
}) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionHeading}>{title}</Text>
      {action && (
        <Pressable onPress={onPress}>
          <Text style={styles.action}>{action}</Text>
        </Pressable>
      )}
    </View>
  )
}

function TransactionRow({ item }: { item: Transaction }) {
  return (
    <View style={styles.transaction}>
      <View
        style={[styles.transactionIcon, { backgroundColor: `${item.color}22` }]}
      >
        <Icon color={item.color} name={item.icon} size={19} />
      </View>
      <View style={styles.transactionCopy}>
        <Text style={styles.transactionTitle}>{item.title}</Text>
        <Text style={styles.meta}>
          {item.category} · {item.date}
        </Text>
      </View>
      <Text
        style={[
          styles.transactionAmount,
          item.kind === 'income' && styles.income,
        ]}
      >
        {item.kind === 'income' ? '+' : '-'}
        {money(item.amount)}
      </Text>
    </View>
  )
}

function Home({
  accounts,
  transactions,
  go,
  add,
}: {
  accounts: Account[]
  transactions: Transaction[]
  go: (tab: Tab) => void
  add: () => void
}) {
  const balance = accounts.reduce((sum, a) => sum + a.balance, 0)
  const income = transactions
    .filter((t) => t.kind === 'income')
    .reduce((sum, t) => sum + t.amount, 0)
  const expenses = transactions
    .filter((t) => t.kind === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)
  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.greeting}>
        <View>
          <Text style={styles.eyebrow}>MI RESUMEN</Text>
          <Text style={styles.greetingText}>
            Hola, Luis <Text style={styles.star}>✦</Text>
          </Text>
        </View>
        <Pressable style={styles.avatarLarge} onPress={() => go('more')}>
          <Text style={styles.avatarText}>L</Text>
        </Pressable>
      </View>
      <View style={styles.balanceCard}>
        <View style={styles.rowBetween}>
          <Text style={styles.balanceLabel}>BALANCE TOTAL</Text>
          <Icon color="rgba(255,255,255,.6)" name="ellipsis-horizontal" />
        </View>
        <Text style={styles.balance}>{money(balance)}</Text>
        <View style={styles.rowBetween}>
          <View style={styles.trend}>
            <Icon color={C.green} name="arrow-up" size={14} />
            <Text style={styles.trendText}>12.8% este mes</Text>
          </View>
          <Text style={styles.currency}>COP</Text>
        </View>
      </View>
      <View style={styles.quickActions}>
        <QuickAction icon="add" label="Agregar" color={C.green} onPress={add} />
        <QuickAction
          icon="swap-horizontal"
          label="Transferir"
          color="#E8EFFA"
          onPress={() => go('transactions')}
        />
        <QuickAction
          icon="pie-chart-outline"
          label="Presupuesto"
          color="#F2ECFF"
          onPress={() => go('budget')}
        />
      </View>
      <View style={styles.stats}>
        <Stat
          icon="arrow-down"
          label="INGRESOS"
          value={money(income)}
          color={C.greenDark}
        />
        <Stat
          icon="arrow-up"
          label="GASTOS"
          value={money(expenses)}
          color={C.red}
        />
      </View>
      <SectionTitle
        title="Movimientos recientes"
        action="Ver todos"
        onPress={() => go('transactions')}
      />
      <View style={styles.card}>
        {transactions.slice(0, 3).map((item) => (
          <TransactionRow item={item} key={item.id} />
        ))}
      </View>
      <SectionTitle
        title="Tus cuentas"
        action="Ver todas"
        onPress={() => go('accounts')}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontal}
      >
        {accounts.map((a) => (
          <View key={a.name} style={styles.miniAccount}>
            <View
              style={[styles.miniIcon, { backgroundColor: `${a.color}22` }]}
            >
              <Icon color={a.color} name={a.icon} size={18} />
            </View>
            <Text style={styles.miniName}>{a.name}</Text>
            <Text style={styles.miniBalance}>{money(a.balance)}</Text>
          </View>
        ))}
      </ScrollView>
    </ScrollView>
  )
}

function QuickAction({
  icon,
  label,
  color,
  onPress,
}: {
  icon: IconName
  label: string
  color: string
  onPress: () => void
}) {
  return (
    <Pressable style={styles.quick} onPress={onPress}>
      <View style={[styles.quickIcon, { backgroundColor: color }]}>
        <Icon name={icon} size={22} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  )
}
function Stat({
  icon,
  label,
  value,
  color,
}: {
  icon: IconName
  label: string
  value: string
  color: string
}) {
  return (
    <View style={styles.stat}>
      <View style={styles.statHead}>
        <Icon color={color} name={icon} size={14} />
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.meta}>Este mes</Text>
    </View>
  )
}

function Transactions({
  items,
  add,
}: {
  items: Transaction[]
  add: () => void
}) {
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.pageHead}>
        <View>
          <Text style={styles.eyebrow}>ACTIVIDAD</Text>
          <Text style={styles.pageTitle}>Movimientos</Text>
        </View>
        <Pressable style={styles.addButton} onPress={add}>
          <Icon name="add" />
        </Pressable>
      </View>
      <View style={styles.search}>
        <Icon color={C.muted} name="search-outline" size={19} />
        <TextInput
          placeholder="Buscar movimiento"
          placeholderTextColor={C.muted}
          style={styles.searchInput}
        />
      </View>
      <View style={styles.filters}>
        <Chip active label="Todos" />
        <Chip label="Gastos" />
        <Chip label="Ingresos" />
        <Chip icon="options-outline" label="Filtros" />
      </View>
      <Text style={styles.month}>FEBRERO 2026</Text>
      <View style={styles.card}>
        {items.map((item) => (
          <TransactionRow item={item} key={item.id} />
        ))}
      </View>
    </ScrollView>
  )
}
function Chip({
  label,
  active,
  icon,
}: {
  label: string
  active?: boolean
  icon?: IconName
}) {
  return (
    <View style={[styles.chip, active && styles.chipActive]}>
      {icon && <Icon color={active ? C.navy : C.muted} name={icon} size={14} />}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </View>
  )
}

function Accounts({ accounts, add }: { accounts: Account[]; add: () => void }) {
  const total = accounts.reduce((sum, a) => sum + a.balance, 0)
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.pageHead}>
        <View>
          <Text style={styles.eyebrow}>PATRIMONIO</Text>
          <Text style={styles.pageTitle}>Mis cuentas</Text>
        </View>
        <Pressable style={styles.addButton} onPress={add}>
          <Icon name="add" />
        </Pressable>
      </View>
      <View style={styles.totalCard}>
        <Text style={styles.darkLabel}>BALANCE EN CUENTAS</Text>
        <Text style={styles.total}>{money(total)}</Text>
        <Text style={styles.totalMeta}>{accounts.length} cuentas activas</Text>
      </View>
      <View style={styles.segment}>
        <Text style={styles.segmentActive}>Todas ({accounts.length})</Text>
        <Text style={styles.segmentText}>Efectivo</Text>
        <Text style={styles.segmentText}>Ahorros</Text>
      </View>
      {accounts.map((a) => (
        <View key={a.name} style={styles.accountCard}>
          <View style={[styles.largeIcon, { backgroundColor: a.color }]}>
            <Icon color="#fff" name={a.icon} size={25} />
          </View>
          <View style={styles.accountCopy}>
            <Text style={styles.accountType}>{a.type.toUpperCase()}</Text>
            <Text style={styles.accountName}>{a.name}</Text>
            <Text style={styles.accountBalance}>{money(a.balance)}</Text>
          </View>
          <Icon color={C.muted} name="chevron-forward" />
        </View>
      ))}
    </ScrollView>
  )
}

function Budget() {
  const data = [
    { n: 'Alimentación', s: 620000, l: 900000, c: C.orange },
    { n: 'Transporte', s: 180000, l: 350000, c: C.blue },
    { n: 'Suscripciones', s: 145000, l: 220000, c: C.purple },
    { n: 'Hogar', s: 410000, l: 700000, c: C.greenDark },
  ]
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.pageHead}>
        <View>
          <Text style={styles.eyebrow}>PLAN DEL MES</Text>
          <Text style={styles.pageTitle}>Presupuesto</Text>
        </View>
        <View style={styles.monthButton}>
          <Text style={styles.monthButtonText}>Feb 2026</Text>
          <Icon name="chevron-down" size={15} />
        </View>
      </View>
      <View style={styles.budgetHero}>
        <View>
          <Text style={styles.darkLabel}>DISPONIBLE ESTE MES</Text>
          <Text style={styles.budgetValue}>{money(2200000)}</Text>
          <Text style={styles.totalMeta}>
            de {money(3800000)} presupuestados
          </Text>
        </View>
        <View style={styles.circle}>
          <Text style={styles.circleText}>58%</Text>
        </View>
      </View>
      <SectionTitle title="Por categoría" action="Administrar" />
      <View style={styles.card}>
        {data.map((d) => (
          <View style={styles.budgetRow} key={d.n}>
            <View style={styles.rowBetween}>
              <View style={styles.budgetName}>
                <View style={[styles.smallDot, { backgroundColor: d.c }]} />
                <Text style={styles.transactionTitle}>{d.n}</Text>
              </View>
              <Text style={styles.budgetAmount}>
                {money(d.s)} <Text style={styles.meta}>/ {money(d.l)}</Text>
              </Text>
            </View>
            <View style={styles.track}>
              <View
                style={[
                  styles.bar,
                  { backgroundColor: d.c, width: `${(d.s / d.l) * 100}%` },
                ]}
              />
            </View>
          </View>
        ))}
      </View>
      <View style={styles.tip}>
        <Icon color={C.greenDark} name="bulb-outline" />
        <Text style={styles.tipText}>
          <Text style={styles.tipTitle}>Vas por buen camino{`\n`}</Text>Tus
          gastos están por debajo de lo planeado este mes.
        </Text>
      </View>
    </ScrollView>
  )
}

function More() {
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.pageHead}>
        <View>
          <Text style={styles.eyebrow}>PREFERENCIAS</Text>
          <Text style={styles.pageTitle}>Más</Text>
        </View>
      </View>
      <View style={styles.profile}>
        <View style={styles.profileAvatar}>
          <Text style={styles.avatarText}>L</Text>
        </View>
        <View style={styles.profileCopy}>
          <Text style={styles.profileName}>Luis Esteban Ramírez</Text>
          <Text style={styles.meta}>Tu cuenta Lesfin</Text>
        </View>
        <Icon color={C.muted} name="chevron-forward" />
      </View>
      <Text style={styles.menuLabel}>CUENTA</Text>
      <View style={styles.card}>
        {[
          ['person-outline', 'Perfil'],
          ['sparkles-outline', 'Plan y límites'],
          ['settings-outline', 'Configuración'],
          ['language-outline', 'Idioma y moneda'],
        ].map(([icon, label]) => (
          <View style={styles.menuRow} key={label}>
            <View style={styles.menuIcon}>
              <Icon name={icon as IconName} size={18} />
            </View>
            <Text style={styles.menuText}>{label}</Text>
            <Icon color={C.muted} name="chevron-forward" size={18} />
          </View>
        ))}
      </View>
      <Text style={styles.menuLabel}>AYUDA</Text>
      <View style={styles.card}>
        <View style={styles.menuRow}>
          <View style={styles.menuIcon}>
            <Icon
              color={C.purple}
              name="chatbubble-ellipses-outline"
              size={18}
            />
          </View>
          <Text style={styles.menuText}>Enviar comentarios</Text>
          <Icon color={C.muted} name="chevron-forward" size={18} />
        </View>
        <View style={styles.menuRow}>
          <View style={styles.menuIcon}>
            <Icon color={C.blue} name="help-circle-outline" size={18} />
          </View>
          <Text style={styles.menuText}>Centro de ayuda</Text>
          <Icon color={C.muted} name="chevron-forward" size={18} />
        </View>
      </View>
      <Text style={styles.version}>LESFIN · VERSIÓN 0.1.0</Text>
    </ScrollView>
  )
}

function AddModal({
  visible,
  close,
  save,
}: {
  visible: boolean
  close: () => void
  save: (t: Transaction) => void
}) {
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [kind, setKind] = useState<Kind>('expense')
  const submit = () => {
    const value = Number(amount.replace(/[^0-9]/g, ''))
    if (!title.trim() || !value)
      return Alert.alert('Faltan datos', 'Escribe una descripción y un valor.')
    save({
      id: Date.now().toString(),
      title: title.trim(),
      category: kind === 'income' ? 'Ingresos' : 'General',
      amount: value,
      kind,
      date: 'Ahora',
      icon: kind === 'income' ? 'arrow-down-outline' : 'receipt-outline',
      color: kind === 'income' ? C.greenDark : C.red,
    })
    setTitle('')
    setAmount('')
    close()
  }
  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={close}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.modal}>
          <View style={styles.handle} />
          <View style={styles.modalHead}>
            <View>
              <Text style={styles.eyebrow}>NUEVO MOVIMIENTO</Text>
              <Text style={styles.modalTitle}>¿Qué pasó?</Text>
            </View>
            <Pressable onPress={close}>
              <Icon color={C.muted} name="close" />
            </Pressable>
          </View>
          <View style={styles.typeToggle}>
            <Pressable
              onPress={() => setKind('expense')}
              style={[styles.type, kind === 'expense' && styles.expenseType]}
            >
              <Text>Gasto</Text>
            </Pressable>
            <Pressable
              onPress={() => setKind('income')}
              style={[styles.type, kind === 'income' && styles.incomeType]}
            >
              <Text>Ingreso</Text>
            </Pressable>
          </View>
          <Text style={styles.inputLabel}>DESCRIPCIÓN</Text>
          <TextInput
            onChangeText={setTitle}
            placeholder="Ej. Almuerzo"
            placeholderTextColor={C.muted}
            style={styles.input}
            value={title}
          />
          <Text style={styles.inputLabel}>VALOR</Text>
          <TextInput
            keyboardType="numeric"
            onChangeText={setAmount}
            placeholder="$ 0"
            placeholderTextColor={C.muted}
            style={[styles.input, styles.amountInput]}
            value={amount}
          />
          <Pressable onPress={submit} style={styles.save}>
            <Text style={styles.saveText}>Guardar movimiento</Text>
            <Icon name="arrow-forward" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

export default function MobileHome() {
  const [tab, setTab] = useState<Tab>('home')
  const [accounts, setAccounts] = useState(initialAccounts)
  const [transactions, setTransactions] = useState(initialTransactions)
  const [modal, setModal] = useState(false)
  const add = (t: Transaction) => {
    setTransactions((all) => [t, ...all])
    setAccounts((all) =>
      all.map((a, i) =>
        i === 0
          ? {
              ...a,
              balance: a.balance + (t.kind === 'income' ? t.amount : -t.amount),
            }
          : a
      )
    )
  }
  const titles = {
    home: 'Inicio',
    transactions: 'Movimientos',
    accounts: 'Cuentas',
    budget: 'Presupuesto',
    more: 'Más',
  }
  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Header title={titles[tab]} onProfile={() => setTab('more')} />
      <View style={styles.content}>
        {tab === 'home' && (
          <Home
            accounts={accounts}
            add={() => setModal(true)}
            go={setTab}
            transactions={transactions}
          />
        )}
        {tab === 'transactions' && (
          <Transactions add={() => setModal(true)} items={transactions} />
        )}
        {tab === 'accounts' && (
          <Accounts accounts={accounts} add={() => setModal(true)} />
        )}
        {tab === 'budget' && <Budget />}
        {tab === 'more' && <More />}
      </View>
      <View style={styles.tabs}>
        {(
          [
            ['home', 'Inicio', 'home-outline'],
            ['transactions', 'Movimientos', 'swap-horizontal-outline'],
            ['accounts', 'Cuentas', 'wallet-outline'],
            ['budget', 'Presupuesto', 'pie-chart-outline'],
            ['more', 'Más', 'menu-outline'],
          ] as const
        ).map(([key, label, icon]) => (
          <Pressable key={key} onPress={() => setTab(key)} style={styles.tab}>
            <Icon
              color={tab === key ? C.greenDark : C.muted}
              name={icon}
              size={21}
            />
            <Text style={[styles.tabText, tab === key && styles.tabActive]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      <AddModal close={() => setModal(false)} save={add} visible={modal} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { backgroundColor: C.bg, flex: 1 },
  content: { flex: 1 },
  scroll: { paddingBottom: 28, paddingHorizontal: 20 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 12,
    paddingHorizontal: 22,
    paddingTop: Platform.OS === 'ios' ? 18 : 14,
  },
  logo: { color: C.text, fontSize: 23, fontWeight: '800', letterSpacing: -1 },
  headerRight: { alignItems: 'center', flexDirection: 'row', gap: 13 },
  headerTitle: {
    color: C.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  bell: { padding: 3, position: 'relative' },
  dot: {
    backgroundColor: C.red,
    borderColor: C.bg,
    borderRadius: 4,
    borderWidth: 1.5,
    height: 8,
    position: 'absolute',
    right: 0,
    top: 1,
    width: 8,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: C.navy,
    borderRadius: 17,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  avatarLarge: {
    alignItems: 'center',
    backgroundColor: C.navy,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  avatarText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  greeting: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 18,
  },
  eyebrow: {
    color: C.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: 5,
  },
  greetingText: {
    color: C.text,
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  star: { color: C.greenDark, fontSize: 20 },
  balanceCard: { backgroundColor: C.navy, borderRadius: 23, padding: 23 },
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  balanceLabel: {
    color: 'rgba(255,255,255,.6)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  balance: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1.2,
    marginVertical: 14,
  },
  trend: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  trendText: { color: C.green, fontSize: 12, fontWeight: '700' },
  currency: {
    color: 'rgba(255,255,255,.55)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 19,
  },
  quick: { alignItems: 'center', gap: 7 },
  quickIcon: {
    alignItems: 'center',
    borderRadius: 17,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  quickLabel: { color: C.text, fontSize: 11, fontWeight: '600' },
  stats: { flexDirection: 'row', gap: 12, marginBottom: 25 },
  stat: {
    backgroundColor: C.card,
    borderColor: C.border,
    borderRadius: 17,
    borderWidth: 1,
    flex: 1,
    padding: 15,
  },
  statHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginBottom: 9,
  },
  statLabel: {
    color: C.muted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  statValue: { color: C.text, fontSize: 17, fontWeight: '800' },
  meta: { color: C.muted, fontSize: 10, marginTop: 3 },
  sectionTitle: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 3,
  },
  sectionHeading: { color: C.text, fontSize: 17, fontWeight: '800' },
  action: { color: C.greenDark, fontSize: 12, fontWeight: '700' },
  card: {
    backgroundColor: C.card,
    borderColor: C.border,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 24,
    paddingHorizontal: 15,
  },
  transaction: {
    alignItems: 'center',
    borderBottomColor: C.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 75,
    paddingVertical: 10,
  },
  transactionIcon: {
    alignItems: 'center',
    borderRadius: 14,
    height: 43,
    justifyContent: 'center',
    width: 43,
  },
  transactionCopy: { flex: 1, marginLeft: 12 },
  transactionTitle: { color: C.text, fontSize: 13, fontWeight: '700' },
  transactionAmount: { color: C.red, fontSize: 12, fontWeight: '800' },
  income: { color: C.greenDark },
  horizontal: { gap: 11, paddingBottom: 8 },
  miniAccount: {
    backgroundColor: C.card,
    borderColor: C.border,
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 145,
    padding: 13,
  },
  miniIcon: {
    alignItems: 'center',
    borderRadius: 11,
    height: 34,
    justifyContent: 'center',
    marginBottom: 12,
    width: 34,
  },
  miniName: { color: C.text, fontSize: 12, fontWeight: '700' },
  miniBalance: { color: C.text, fontSize: 15, fontWeight: '800', marginTop: 5 },
  pageHead: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 22,
    paddingTop: 20,
  },
  pageTitle: {
    color: C.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: C.green,
    borderRadius: 14,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  search: {
    alignItems: 'center',
    backgroundColor: C.card,
    borderColor: C.border,
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 13,
  },
  searchInput: {
    color: C.text,
    flex: 1,
    fontSize: 13,
    height: 45,
    marginLeft: 8,
  },
  filters: { flexDirection: 'row', gap: 7, marginVertical: 17 },
  chip: {
    alignItems: 'center',
    backgroundColor: C.card,
    borderColor: C.border,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: C.green, borderColor: C.green },
  chipText: { color: C.muted, fontSize: 11, fontWeight: '700' },
  chipTextActive: { color: C.navy },
  month: {
    color: C.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 10,
  },
  totalCard: {
    backgroundColor: C.green,
    borderRadius: 22,
    marginBottom: 18,
    padding: 23,
  },
  darkLabel: {
    color: 'rgba(29,37,48,.62)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.3,
  },
  total: { color: C.navy, fontSize: 32, fontWeight: '800', marginVertical: 12 },
  totalMeta: { color: 'rgba(255,255,255,.6)', fontSize: 11 },
  segment: {
    backgroundColor: '#EEF0EB',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    padding: 4,
  },
  segmentActive: {
    backgroundColor: C.card,
    borderRadius: 9,
    color: C.text,
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  segmentText: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  accountCard: {
    alignItems: 'center',
    backgroundColor: C.card,
    borderColor: C.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 11,
    padding: 16,
  },
  largeIcon: {
    alignItems: 'center',
    borderRadius: 15,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  accountCopy: { flex: 1, marginLeft: 13 },
  accountType: {
    color: C.muted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  accountName: { color: C.text, fontSize: 14, fontWeight: '700', marginTop: 4 },
  accountBalance: {
    color: C.text,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 6,
  },
  monthButton: {
    alignItems: 'center',
    backgroundColor: C.card,
    borderColor: C.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    padding: 10,
  },
  monthButtonText: { color: C.text, fontSize: 11, fontWeight: '700' },
  budgetHero: {
    alignItems: 'center',
    backgroundColor: C.navy,
    borderRadius: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    padding: 22,
  },
  budgetValue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    marginVertical: 9,
  },
  circle: {
    alignItems: 'center',
    borderColor: C.green,
    borderRadius: 40,
    borderWidth: 7,
    height: 80,
    justifyContent: 'center',
    width: 80,
  },
  circleText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  budgetRow: { paddingVertical: 13 },
  budgetName: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  smallDot: { borderRadius: 4, height: 8, width: 8 },
  budgetAmount: { color: C.text, fontSize: 11, fontWeight: '800' },
  track: {
    backgroundColor: '#EEF0EB',
    borderRadius: 3,
    height: 6,
    marginTop: 9,
    overflow: 'hidden',
  },
  bar: { borderRadius: 3, height: 6 },
  tip: {
    alignItems: 'center',
    backgroundColor: '#F1F8DF',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 12,
    padding: 15,
  },
  tipText: { color: C.muted, flex: 1, fontSize: 11, lineHeight: 17 },
  tipTitle: { color: C.text, fontWeight: '800' },
  profile: {
    alignItems: 'center',
    backgroundColor: C.card,
    borderColor: C.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 25,
    padding: 16,
  },
  profileAvatar: {
    alignItems: 'center',
    backgroundColor: C.navy,
    borderRadius: 25,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  profileCopy: { flex: 1, marginLeft: 12 },
  profileName: { color: C.text, fontSize: 14, fontWeight: '800' },
  menuLabel: {
    color: C.muted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 10,
    marginLeft: 3,
  },
  menuRow: {
    alignItems: 'center',
    borderBottomColor: C.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 61,
  },
  menuIcon: {
    alignItems: 'center',
    backgroundColor: '#F2F4F0',
    borderRadius: 10,
    height: 35,
    justifyContent: 'center',
    width: 35,
  },
  menuText: {
    color: C.text,
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 12,
  },
  version: {
    color: C.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 28,
    textAlign: 'center',
  },
  tabs: {
    backgroundColor: C.card,
    borderTopColor: C.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: Platform.OS === 'ios' ? 22 : 9,
    paddingTop: 9,
  },
  tab: { alignItems: 'center', gap: 3, minWidth: 58 },
  tabText: { color: C.muted, fontSize: 9, fontWeight: '700' },
  tabActive: { color: C.greenDark },
  overlay: {
    backgroundColor: 'rgba(29,37,48,.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    paddingBottom: Platform.OS === 'ios' ? 38 : 22,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: '#D5D9D2',
    borderRadius: 3,
    height: 5,
    marginBottom: 20,
    width: 42,
  },
  modalHead: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: { color: C.text, fontSize: 25, fontWeight: '800' },
  typeToggle: {
    backgroundColor: '#EDEFEB',
    borderRadius: 12,
    flexDirection: 'row',
    marginBottom: 22,
    padding: 4,
  },
  type: { alignItems: 'center', borderRadius: 9, flex: 1, paddingVertical: 11 },
  expenseType: { backgroundColor: '#FBEAEA' },
  incomeType: { backgroundColor: '#EAF5D2' },
  inputLabel: {
    color: C.muted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.3,
    marginBottom: 7,
    marginTop: 8,
  },
  input: {
    backgroundColor: C.card,
    borderColor: C.border,
    borderRadius: 12,
    borderWidth: 1,
    color: C.text,
    fontSize: 15,
    height: 49,
    paddingHorizontal: 14,
  },
  amountInput: { fontSize: 21, fontWeight: '800' },
  save: {
    alignItems: 'center',
    backgroundColor: C.green,
    borderRadius: 13,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginTop: 25,
    paddingVertical: 15,
  },
  saveText: { color: C.navy, fontSize: 13, fontWeight: '800' },
})
