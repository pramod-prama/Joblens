import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { OrbitControls, Center, useGLTF } from "@react-three/drei";

const AvatarModel = ({ url }: { url: string }) => {
  const gltf = useGLTF(url);
  return <primitive object={gltf.scene} scale={0.8} />;
};

const Avatar3D = ({ modelSrc }: { modelSrc: string }) => {
  return (
    <div className="h-80 w-80 rounded-xl overflow-hidden bg-gray-100">
      <Canvas camera={{ position: [0, 1.5, 2.5], fov: 30 }}>
        <ambientLight intensity={1} />
        <directionalLight position={[3, 3, 5]} intensity={2} />
        <Suspense fallback={<div>Loading Avatar...</div>}>
          <Center>
            <AvatarModel url={modelSrc} />
          </Center>
        </Suspense>
        <OrbitControls enablePan={false} enableZoom={false} autoRotate />
      </Canvas>
    </div>
  );
};

export default Avatar3D;
