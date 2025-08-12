import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { FolderOpen, Link2, Users, CheckCircle, Undo2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const ResumeFolderInput = () => {
  const [folderPath, setFolderPath] = useState('');
  const [cloudLink, setCloudLink] = useState('');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<any[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [activeTab, setActiveTab] = useState('folder');
  const { toast } = useToast();

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setFolderPath(`${files.length} files selected`);
      toast({
        title: 'Folder selected',
        description: `Found ${files.length} resume files`,
      });
    }
  };

  const handleReset = () => {
    setFolderPath('');
    setCloudLink('');
    setIsCompleted(false);
    setResults([]);
    setProgress(0);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'qualified': return 'text-green-600 bg-green-50';
      case 'review': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-red-600 bg-red-50';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card className="h-full border-0 shadow-lg bg-white/80 backdrop-blur-sm flex flex-col">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
            <FolderOpen className="h-4 w-4 text-white" />
          </div>
          <div>
            <CardTitle className="text-xl">Resume Folder Input</CardTitle>
            <CardDescription>
              Upload a folder or paste a cloud storage link to resumes
            </CardDescription>
          </div>
        </div>
        {isCompleted && (
          <div className="flex items-center space-x-2 text-green-600 bg-green-50 p-2 rounded-lg mt-2">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm font-medium">{results.length} resumes processed successfully</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4 flex-grow overflow-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="folder">Folder Upload</TabsTrigger>
            <TabsTrigger value="cloud">Cloud Folder Link</TabsTrigger>
          </TabsList>

          {/* Folder Upload Tab */}
          <TabsContent value="folder">
            <div className="space-y-2">
              <Label htmlFor="folder-input">Choose Folder</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-purple-400 transition-colors">
                <FolderOpen className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 mb-4">
                  Upload a folder containing resume files (.pdf, .docx)
                </p>
                <div className="flex items-center justify-center space-x-3">
                  <div className="relative inline-block">
                    <label htmlFor="folder-input">
                      <Button variant="outline" className="text-sm">
                        📁 Choose Folder
                      </Button>
                    </label>
                    <Input
                      id="folder-input"
                      type="file"
                      multiple
                      accept=".pdf,.docx"
                      webkitdirectory="true"
                      directory=""
                      onChange={handleFolderSelect}
                      className="absolute left-0 top-0 opacity-0 w-full h-full cursor-pointer"
                    />
                  </div>
                  <span className="text-sm text-gray-700">
                    {folderPath || 'No folder chosen'}
                  </span>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Cloud Folder Link Tab */}
          <TabsContent value="cloud">
            <div className="space-y-2">
              <Label htmlFor="cloud-link">Paste Cloud Folder Link</Label>
              <div className="relative">
                <Link2 className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="cloud-link"
                  type="url"
                  placeholder="https://drive.google.com/..."
                  value={cloudLink}
                  onChange={(e) => setCloudLink(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {progress > 0 && progress < 100 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>Processing resumes...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-gray-800">Processing Results</h4>
              <div className="flex items-center text-sm text-gray-600">
                <Users className="h-4 w-4 mr-1" />
                {results.length} candidates
              </div>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {results.map((candidate, index) => (
                <div key={index} className="border rounded-lg p-4 bg-white">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h5 className="font-semibold text-gray-900">{candidate.name}</h5>
                      <p className="text-sm text-gray-600">{candidate.email}</p>
                      <p className="text-sm text-gray-600">{candidate.phone}</p>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${getScoreColor(candidate.atsScore)}`}>
                        {candidate.atsScore}%
                      </div>
                      <div className={`text-xs px-2 py-1 rounded-full ${getStatusColor(candidate.status)}`}>
                        {candidate.status === 'qualified' ? 'Qualified' : 'Needs Review'}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="font-medium text-green-700 mb-1">Strengths:</p>
                      <div className="flex flex-wrap gap-1">
                        {candidate.strengths.map((strength: string, i: number) => (
                          <span key={i} className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                            {strength}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="font-medium text-orange-700 mb-1">Gaps:</p>
                      <div className="flex flex-wrap gap-1">
                        {candidate.gaps.map((gap: string, i: number) => (
                          <span key={i} className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs">
                            {gap}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end mt-4">
          <Button
            variant="ghost"
            onClick={handleReset}
            className="text-red-500 hover:text-red-700"
          >
            <Undo2 className="w-4 h-4 mr-1" />
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ResumeFolderInput;
