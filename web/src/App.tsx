import { match, useRoute } from './lib/router';
import Start from './screens/Start';
import Check from './screens/Check';
import Session from './screens/Session';
import Done from './screens/Done';
import Dashboard from './screens/Dashboard';
import Report from './screens/Report';

export default function App() {
  const path = useRoute();
  const report = match('/admin/report/:id', path);

  let screen: React.ReactNode;
  if (path === '/check') screen = <Check />;
  else if (path === '/session') screen = <Session />;
  else if (path === '/done') screen = <Done />;
  else if (path === '/admin') screen = <Dashboard />;
  else if (report) screen = <Report id={report.id} />;
  else screen = <Start />;

  return (
    <div className="page" key={path}>
      {screen}
    </div>
  );
}
