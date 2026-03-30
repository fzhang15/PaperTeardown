import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { PaperList } from './pages/PaperList'
import { PaperView } from './pages/PaperView'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PaperList />} />
        <Route path="/paper/:id" element={<PaperView />} />
      </Routes>
    </BrowserRouter>
  )
}
