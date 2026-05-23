import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import Login from './components/Login';
import Home from './components/Home';
import Terms from './components/Terms';
import Privacy from './components/Privacy';
import Unauthorized from './components/Unauthorized';
import AdminRoute from './components/AdminRoute';
import AdminPanel from './components/AdminPanel';
import Lists from './components/Lists';
import ProtectedRoute from './components/ProtectedRoute';
import EmailSettings from './components/EmailSetting';

function App() {
  const appRouter = createBrowserRouter([
    {
      path: "/",
      element : <Login/>
    },
    {
      path: "/home",
      // element:<ProtectedRoute><Home/></ProtectedRoute>
      element:<Home/>
    },
    {
      path: "/terms",
      element:<Terms/>
    },
    {
      path: "/privacy",
      element:<Privacy/>
    },
    {
      path: "/unauthorized",
      element:<Unauthorized/>
    },
    {
      path: "/lists",
      element:<ProtectedRoute><Lists/></ProtectedRoute>
    },
    {
      path: "/admin",
      // element: <ProtectedRoute><AdminRoute><AdminPanel /></AdminRoute></ProtectedRoute>
      element:<AdminPanel/>
    },
    {
      path: "/email-settings",
      element: <ProtectedRoute><EmailSettings /></ProtectedRoute>
    }
  ])

  return (
    <div>
      <RouterProvider router={appRouter}/>
    </div>
  )
}
export default App; 